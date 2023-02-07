import {
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
  ExchangeTxInfo,
  OptimalSwapExchange,
  PreprocessTransactionOptions,
} from '../../types';
import { SwapSide, Network, ETHER_ADDRESS } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { HashflowData, PriceLevel, RfqError, RFQType } from './types';
import { SimpleExchange } from '../simple-exchange';
import { Adapters, HashflowConfig } from './config';
import { HashflowApi } from '@hashflow/taker-js';
import routerAbi from '../../abi/hashflow/HashflowRouter.abi.json';
import BigNumber from 'bignumber.js';
import { BN_0, BN_1, getBigNumberPow } from '../../bignumber-constants';
import { Interface } from 'ethers/lib/utils';
import { ChainId, ZERO_ADDRESS } from '@hashflow/sdk';
import { PriceLevelsResponse } from '@hashflow/taker-js/dist/types/rest';
import { assert } from 'ts-essentials';
import { PRICE_LEVELS_TTL_SECONDS } from './constants';

export class Hashflow extends SimpleExchange implements IDex<HashflowData> {
  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = false;
  readonly isFeeOnTransferSupported = false;
  private api: HashflowApi;

  private hashFlowAuthToken: string;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(HashflowConfig);

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
    readonly routerAddress: string = HashflowConfig['Hashflow'][network]
      .routerAddress,
    protected routerInterface = new Interface(routerAbi),
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    const token = dexHelper.config.data.hashFlowAuthToken;
    assert(
      token !== undefined,
      'Hashflow auth token is not specified with env variable',
    );
    this.hashFlowAuthToken = token;
    this.api = new HashflowApi('taker', 'paraswap', this.hashFlowAuthToken);
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  getPairName = (srcAddress: Address, destAddress: Address) =>
    `${srcAddress}_${destAddress}`.toLowerCase();

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    const _srcAddress = this.dexHelper.config
      .wrapETH(srcToken)
      .address.toLowerCase();
    const _destAddress = this.dexHelper.config
      .wrapETH(destToken)
      .address.toLowerCase();
    const chainId = this.network as ChainId;

    if (_srcAddress === _destAddress) {
      return [];
    }

    const pairName = this.getPairName(_srcAddress, _destAddress);

    const makers = await this.api.getMarketMakers(chainId);
    const levels = await this.api.getPriceLevels(chainId, makers);

    return makers
      .filter(m => {
        const pairs = levels[m]?.map(entry => entry.pair) ?? [];
        return pairs.some(
          p =>
            _srcAddress === p.baseToken.toLowerCase() &&
            _destAddress === p.quoteToken.toLowerCase(),
        );
      })
      .map(m => `${this.dexKey}_${pairName}_${m}`);
  }

  computePricesFromLevels(
    amounts: BigNumber[],
    levels: PriceLevel[],
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
  ): bigint[] {
    if (levels.length > 0) {
      const firstLevel = levels[0];
      if (new BigNumber(firstLevel.level).gt(0)) {
        // Add zero level for price computation
        levels.unshift({ level: '0', price: firstLevel.price });
      }
    }

    const outputs = new Array<BigNumber>(amounts.length).fill(BN_0);
    for (const [i, amount] of amounts.entries()) {
      if (amount.isZero()) {
        outputs[i] = BN_0;
      } else {
        const output =
          side === SwapSide.SELL
            ? this.computeLevelsQuote(levels, amount, undefined)
            : this.computeLevelsQuote(levels, undefined, amount);

        if (output === undefined) {
          // If current amount was unfillable, then bigger amounts are unfillable as well
          break;
        } else {
          outputs[i] = output;
        }
      }
    }

    const decimals =
      side === SwapSide.SELL ? destToken.decimals : srcToken.decimals;

    return outputs.map(o =>
      BigInt(o.multipliedBy(getBigNumberPow(decimals)).toFixed(0)),
    );
  }

  toPriceLevelsBN = (
    priceLevels: PriceLevel[],
  ): { level: BigNumber; price: BigNumber }[] =>
    priceLevels.map(l => ({
      level: new BigNumber(l.level),
      price: new BigNumber(l.price),
    }));

  computeLevelsQuote(
    priceLevels: PriceLevel[],
    reqBaseAmount?: BigNumber,
    reqQuoteAmount?: BigNumber,
  ): BigNumber | undefined {
    if (reqBaseAmount && reqQuoteAmount) {
      return undefined;
    }

    const levels = this.toPriceLevelsBN(priceLevels);
    if (!levels.length) {
      return undefined;
    }

    const quote = {
      baseAmount: levels[0]!.level,
      quoteAmount: levels[0]!.level.multipliedBy(levels[0]!.price),
    };
    if (
      (reqBaseAmount && reqBaseAmount.lt(quote.baseAmount)) ||
      (reqQuoteAmount && reqQuoteAmount.lt(quote.quoteAmount))
    ) {
      return undefined;
    }

    for (let i = 1; i < levels.length; i++) {
      const nextLevel = levels[i]!;
      const nextLevelDepth = nextLevel.level.minus(levels[i - 1]!.level);
      const nextLevelQuote = quote.quoteAmount.plus(
        nextLevelDepth.multipliedBy(nextLevel.price),
      );
      if (reqBaseAmount && reqBaseAmount.lte(nextLevel.level)) {
        const baseDifference = reqBaseAmount.minus(quote.baseAmount);
        const quoteAmount = quote.quoteAmount.plus(
          baseDifference.multipliedBy(nextLevel.price),
        );
        return quoteAmount;
      } else if (reqQuoteAmount && reqQuoteAmount.lte(nextLevelQuote)) {
        const quoteDifference = reqQuoteAmount.minus(quote.quoteAmount);
        const baseAmount = quote.baseAmount.plus(
          quoteDifference.dividedBy(nextLevel.price),
        );
        return baseAmount;
      }

      quote.baseAmount = nextLevel.level;
      quote.quoteAmount = nextLevelQuote;
    }

    return undefined;
  }

  async getLevels(
    pools: string[],
    prefix: string,
  ): Promise<PriceLevelsResponse['levels']> {
    const cachedLevels = await this.dexHelper.cache.get(
      this.dexKey,
      this.network as ChainId,
      `levels`,
    );
    if (cachedLevels) {
      return JSON.parse(cachedLevels) as PriceLevelsResponse['levels'];
    }

    const makers = pools.map(p => p.split(`${prefix}_`).pop()!);
    const levels = await this.api.getPriceLevels(
      this.network as ChainId,
      makers,
    );

    await this.dexHelper.cache.setex(
      this.dexKey,
      this.network as ChainId,
      `levels`,
      PRICE_LEVELS_TTL_SECONDS,
      JSON.stringify(levels),
    );

    return levels;
  }

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<HashflowData>> {
    const _srcToken = this.dexHelper.config.wrapETH(srcToken);
    const _destToken = this.dexHelper.config.wrapETH(destToken);
    _srcToken.address = _srcToken.address.toLowerCase();
    _destToken.address = _destToken.address.toLowerCase();

    if (_srcToken.address === _destToken.address) {
      return null;
    }

    const prefix = `${this.dexKey}_${this.getPairName(
      _srcToken.address,
      _destToken.address,
    )}`;

    const pools =
      limitPools ??
      (await this.getPoolIdentifiers(srcToken, destToken, side, blockNumber));

    const levelsMap = await this.getLevels(pools, prefix);

    const levelEntries: {
      mm: string;
      levels: PriceLevel[];
    }[] = Object.keys(levelsMap)
      .map(mm => {
        const entry = levelsMap[mm]?.find(
          e =>
            `${e.pair.baseToken}_${e.pair.quoteToken}` ===
            this.getPairName(_srcToken.address, _destToken.address),
        );
        if (entry === undefined) {
          return undefined;
        } else {
          return { mm, levels: entry.levels };
        }
      })
      .filter(o => o !== undefined)
      .map(o => o!);

    const prices = levelEntries.map(lEntry => {
      const { mm, levels } = lEntry;

      const amountsRaw = amounts.map(a =>
        new BigNumber(a.toString()).dividedBy(
          getBigNumberPow(
            side === SwapSide.SELL ? _srcToken.decimals : _destToken.decimals,
          ),
        ),
      );

      const unitPrice = this.computePricesFromLevels(
        [BN_1],
        levels,
        _srcToken,
        _destToken,
        side,
      )[0];
      const prices = this.computePricesFromLevels(
        amountsRaw,
        levels,
        _srcToken,
        _destToken,
        side,
      );

      return {
        gasCost: 100_000,
        exchange: this.dexKey,
        prices,
        unit: unitPrice,
        poolIdentifier: `${prefix}_${mm}`,
        poolAddresses: [this.routerAddress],
      } as PoolPrices<HashflowData>;
    });

    return prices;
  }

  async preProcessTransaction(
    optimalSwapExchange: OptimalSwapExchange<HashflowData>,
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    options: PreprocessTransactionOptions,
  ): Promise<[OptimalSwapExchange<HashflowData>, ExchangeTxInfo]> {
    const chainId = this.network as ChainId;

    const _srcToken = this.dexHelper.config.wrapETH(srcToken);
    const _destToken = this.dexHelper.config.wrapETH(destToken);
    _srcToken.address = _srcToken.address.toLowerCase();
    _destToken.address = _destToken.address.toLowerCase();

    const baseTokenAmount = optimalSwapExchange.srcAmount;
    const quoteTokenAmount = optimalSwapExchange.destAmount;

    const rfq = await this.api.requestQuote({
      chainId,
      baseToken: _srcToken.address,
      quoteToken: _destToken.address,
      ...(side === SwapSide.SELL ? { baseTokenAmount } : { quoteTokenAmount }),
      wallet: this.augustusAddress.toLowerCase(),
      effectiveTrader: options.txOrigin.toLowerCase(),
    });

    if (rfq.status !== 'success') {
      const message = `${
        this.dexKey
      }: Failed to fetch RFQ for ${this.getPairName(
        _srcToken.address,
        _destToken.address,
      )}. Status: ${rfq.status}`;
      this.logger.warn(message);
      throw new RfqError(message);
    } else if (!rfq.quoteData) {
      const message = `${
        this.dexKey
      }: Failed to fetch RFQ for ${this.getPairName(
        _srcToken.address,
        _destToken.address,
      )}. Missing quote data`;
      this.logger.warn(message);
      throw new RfqError(message);
    } else if (!rfq.signature) {
      const message = `${
        this.dexKey
      }: Failed to fetch RFQ for ${this.getPairName(
        _srcToken.address,
        _destToken.address,
      )}. Missing signature`;
      this.logger.warn(message);
      throw new RfqError(message);
    } else if (!rfq.gasEstimate) {
      const message = `${
        this.dexKey
      }: Failed to fetch RFQ for ${this.getPairName(
        _srcToken.address,
        _destToken.address,
      )}. No gas estimate.`;
      this.logger.warn(message);
      throw new RfqError(message);
    } else if (rfq.quoteData.rfqType !== RFQType.RFQT) {
      const message = `${
        this.dexKey
      }: Failed to fetch RFQ for ${this.getPairName(
        _srcToken.address,
        _destToken.address,
      )}. Invalid RFQ type.`;
      this.logger.warn(message);
      throw new RfqError(message);
    }

    return [
      {
        ...optimalSwapExchange,
        data: {
          quoteData: rfq.quoteData,
          signature: rfq.signature,
          gasEstimate: rfq.gasEstimate,
        },
      },
      { deadline: BigInt(rfq.quoteData.quoteExpiry) },
    ];
  }

  getCalldataGasCost(poolPrices: PoolPrices<HashflowData>): number | number[] {
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  getTokenFromAddress?(address: Address): Token {
    // We don't have predefined set of tokens with decimals
    // Anyway we don't use decimals, so it is fine to do this
    return { address, decimals: 0 };
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: HashflowData,
    side: SwapSide,
  ): AdapterExchangeParam {
    const { quoteData, signature, gasEstimate } = data;

    // Encoding here the payload for adapter
    const payload = this.routerInterface._abiCoder.encode(
      [
        'tuple(address, address, address, address, address, address, uint256, unit256, uint256, uint256, uint256, bytes32, bytes)',
      ],
      [
        [
          quoteData.pool,
          quoteData.eoa ?? ZERO_ADDRESS,
          quoteData.trader,
          quoteData.effectiveTrader ?? quoteData.trader,
          quoteData.baseToken,
          quoteData.quoteToken,
          quoteData.baseTokenAmount,
          quoteData.baseTokenAmount,
          quoteData.quoteTokenAmount,
          quoteData.quoteExpiry,
          quoteData.nonce ?? 0,
          quoteData.txid,
          signature,
        ],
      ],
    );

    return {
      targetExchange: this.dexKey,
      payload,
      networkFee: gasEstimate.toFixed(),
    };
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: HashflowData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const { quoteData, signature } = data;

    // Encode here the transaction arguments
    const swapData = this.routerInterface.encodeFunctionData('tradeSingleHop', [
      [
        quoteData.pool,
        quoteData.eoa ?? ZERO_ADDRESS,
        quoteData.trader,
        quoteData.effectiveTrader ?? quoteData.trader,
        quoteData.baseToken,
        quoteData.quoteToken,
        quoteData.baseTokenAmount,
        quoteData.baseTokenAmount,
        quoteData.quoteTokenAmount,
        quoteData.quoteExpiry,
        quoteData.nonce ?? 0,
        quoteData.txid,
        signature,
      ],
    ]);

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      quoteData.baseTokenAmount,
      destToken,
      quoteData.quoteTokenAmount,
      swapData,
      this.routerAddress,
    );
  }

  extractQuoteToken = (pair: {
    baseToken: string;
    baseTokenName: string;
    quoteToken: string;
    quoteTokenName: string;
    baseTokenDecimals: number;
    quoteTokenDecimals: number;
  }): Token => ({
    address: pair.quoteToken,
    symbol: pair.quoteTokenName,
    decimals: pair.quoteTokenDecimals,
  });

  computeMaxLiquidity = (
    levels: PriceLevel[],
    baseTokenPriceUsd: number,
  ): number => {
    const maxLevel = new BigNumber(levels[levels.length - 1]?.level ?? '0');
    return maxLevel.multipliedBy(baseTokenPriceUsd).toNumber();
  };

  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    const _tokenAddress = tokenAddress.toLowerCase();

    const chainId = this.network as ChainId;
    const makers = await this.api.getMarketMakers(chainId);
    const pLevels = await this.api.getPriceLevels(chainId, makers);

    let baseToken: Token | undefined = undefined;
    // TODO: Improve efficiency of this part. Quite inefficient way to determine
    // Token address and decimals. But since it is not called frequently, not worth
    // optimizing now
    for (const maker of makers) {
      const baseTokenEntry = pLevels[maker]?.find(
        entry => entry.pair.baseToken.toLowerCase() === _tokenAddress,
      );
      if (baseTokenEntry) {
        baseToken = {
          address: _tokenAddress,
          decimals: baseTokenEntry.pair.baseTokenDecimals,
        };
        break;
      }
    }

    if (baseToken === undefined) {
      return [];
    }

    const baseTokenPriceUsd = await this.dexHelper.getTokenUSDPrice(
      baseToken,
      BigInt(getBigNumberPow(baseToken.decimals).toFixed(0)),
    );

    const pools = makers
      .map(
        m =>
          pLevels[m]
            ?.filter(
              entry => entry.pair.baseToken.toLowerCase() === _tokenAddress,
            )
            .map(
              entry =>
                ({
                  exchange: this.dexKey,
                  address: this.routerAddress,
                  connectorTokens: [this.extractQuoteToken(entry.pair)],
                  liquidityUSD: this.computeMaxLiquidity(
                    entry.levels,
                    baseTokenPriceUsd,
                  ),
                } as PoolLiquidity),
            ) ?? [],
      )
      .flatMap(pl => pl);

    return pools
      .sort((a, b) => b.liquidityUSD - a.liquidityUSD)
      .slice(0, limit);
  }
}
