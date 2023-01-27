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
import { HashflowData, PriceLevel, RfqError } from './types';
import { SimpleExchange } from '../simple-exchange';
import { HashflowConfig } from './config';
import { HashflowApi } from '@hashflow/taker-js';
import routerAbi from '../../abi/hashflow/HashflowRouter.abi.json';
import BigNumber from 'bignumber.js';
import { BN_0, BN_1, getBigNumberPow } from '../../bignumber-constants';
import { Interface } from 'ethers/lib/utils';
import { ChainId, ZERO_ADDRESS } from '@hashflow/sdk';
import { PriceLevelsResponse } from '@hashflow/taker-js/dist/types/rest';

const HASHFLOW_AUTH_KEY = 'TODO';
const PRICE_LEVELS_TTL_SECONDS = 1;

enum RFQType {
  RFQT = 0,
  RFQM = 1,
}

export class Hashflow extends SimpleExchange implements IDex<HashflowData> {
  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = false;
  readonly isFeeOnTransferSupported = false;
  private api: HashflowApi;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(HashflowConfig);

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    readonly routerAddress: string = HashflowConfig['Hashflow'][network]
      .routerAddress,
    protected routerInterface = new Interface(routerAbi),
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    this.api = new HashflowApi('taker', 'paraswap', HASHFLOW_AUTH_KEY);
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return null;
  }

  getPairName = (pair: { baseToken: Token; quoteToken: Token }) =>
    `${pair.baseToken.address}_${pair.quoteToken.address}`.toLowerCase();

  normalizeToken(token: Token): Token {
    return {
      address:
        token.address === ETHER_ADDRESS
          ? ZERO_ADDRESS
          : token.address.toLowerCase(),
      decimals: token.decimals,
    };
  }

  // Returns list of pool identifiers that can be used
  // for a given swap. poolIdentifiers must be unique
  // across DEXes. It is recommended to use
  // ${dexKey}_${poolAddress} as a poolIdentifier
  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    const chainId = this.network as ChainId;
    const pair = {
      baseToken: this.normalizeToken(srcToken),
      quoteToken: this.normalizeToken(destToken),
    };
    const pairName = this.getPairName(pair);

    const makers = await this.api.getMarketMakers(chainId);
    const levels = await this.api.getPriceLevels(chainId, makers);
    return makers
      .filter(m => {
        const pairs = levels[m]?.map(entry => entry.pair) ?? [];
        return pairs.some(
          p =>
            pair.baseToken.address.toLowerCase() ===
              p.baseToken.toLowerCase() &&
            pair.quoteToken.address.toLowerCase() ===
              p.quoteToken.toLowerCase(),
        );
      })
      .map(m => `${this.dexKey}_${pairName}_${m}`);
  }
  computePricesFromLevels(
    amounts: BigNumber[],
    levels: PriceLevel[],
    pair: { baseToken: Token; quoteToken: Token },
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
      side === SwapSide.SELL
        ? pair.quoteToken.decimals
        : pair.baseToken.decimals;

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

  // Returns pool prices for amounts.
  // If limitPools is defined only pools in limitPools
  // should be used. If limitPools is undefined then
  // any pools can be used.
  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<HashflowData>> {
    const chainId = this.network as ChainId;

    const pair = {
      baseToken: this.normalizeToken(srcToken),
      quoteToken: this.normalizeToken(destToken),
    };

    const prefix = `${this.dexKey}_${this.getPairName(pair)}`;

    const getLevels = async (): Promise<PriceLevelsResponse['levels']> => {
      const cachedLevels = await this.dexHelper.cache.get(
        this.dexKey,
        chainId,
        `levels`,
      );
      if (cachedLevels) {
        return JSON.parse(cachedLevels) as PriceLevelsResponse['levels'];
      }

      const pools =
        limitPools ??
        (await this.getPoolIdentifiers(
          pair.baseToken,
          pair.quoteToken,
          side,
          blockNumber,
        ));

      const makers = pools.map(p => p.split(`${prefix}_`).pop()!);
      const levels = await this.api.getPriceLevels(chainId, makers);

      await this.dexHelper.cache.setex(
        this.dexKey,
        chainId,
        `levels`,
        PRICE_LEVELS_TTL_SECONDS,
        JSON.stringify(levels),
      );

      return levels;
    };

    const levelsMap = await getLevels();
    const levelEntries: {
      mm: string;
      levels: PriceLevel[];
    }[] = Object.keys(levelsMap)
      .map(mm => {
        const entry = levelsMap[mm]?.find(
          e =>
            `${e.pair.baseToken}_${e.pair.quoteToken}` ===
            this.getPairName(pair),
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
            side === SwapSide.SELL
              ? pair.baseToken.decimals
              : pair.quoteToken.decimals,
          ),
        ),
      );

      const unitPrice = this.computePricesFromLevels(
        [BN_1],
        levels,
        pair,
        side,
      )[0];
      const prices = this.computePricesFromLevels(
        amountsRaw,
        levels,
        pair,
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

    const pair = {
      baseToken: this.normalizeToken(srcToken),
      quoteToken: this.normalizeToken(destToken),
    };

    const baseTokenAmount = optimalSwapExchange.srcAmount;
    const quoteTokenAmount = optimalSwapExchange.destAmount;

    const rfq = await this.api.requestQuote({
      chainId,
      baseToken: pair.baseToken.address,
      quoteToken: pair.quoteToken.address,
      ...(side === SwapSide.SELL ? { baseTokenAmount } : { quoteTokenAmount }),
      wallet: this.augustusAddress.toLowerCase(),
      effectiveTrader: options.txOrigin.toLowerCase(),
    });

    if (rfq.status !== 'success') {
      const message = `${
        this.dexKey
      }: Failed to fetch RFQ for ${this.getPairName(pair)}. Status: ${
        rfq.status
      }`;
      this.logger.warn(message);
      throw new RfqError(message);
    } else if (!rfq.quoteData) {
      const message = `${
        this.dexKey
      }: Failed to fetch RFQ for ${this.getPairName(pair)}. Missing quote data`;
      this.logger.warn(message);
      throw new RfqError(message);
    } else if (!rfq.signature) {
      const message = `${
        this.dexKey
      }: Failed to fetch RFQ for ${this.getPairName(pair)}. Missing signature`;
      this.logger.warn(message);
      throw new RfqError(message);
    } else if (!rfq.gasEstimate) {
      const message = `${
        this.dexKey
      }: Failed to fetch RFQ for ${this.getPairName(pair)}. No gas estimate.`;
      this.logger.warn(message);
      throw new RfqError(message);
    } else if (rfq.quoteData.rfqType !== RFQType.RFQT) {
      const message = `${
        this.dexKey
      }: Failed to fetch RFQ for ${this.getPairName(pair)}. Invalid RFQ type.`;
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

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<HashflowData>): number | number[] {
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  getTokenFromAddress?(address: Address): Token {
    // We don't have predefined set of tokens with decimals
    // Anyway we don't use decimals, so it is fine to do this
    return { address, decimals: 0 };
  }

  // Encode params required by the exchange adapter
  // Used for multiSwap, buy & megaSwap
  // Hint: abiCoder.encodeParameter() could be useful
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

  // Encode call data used by simpleSwap like routers
  // Used for simpleSwap & simpleBuy
  // Hint: this.buildSimpleParamWithoutWETHConversion
  // could be useful
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

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    const chainId = this.network as ChainId;
    const makers = await this.api.getMarketMakers(chainId);
    const pLevels = await this.api.getPriceLevels(chainId, makers);

    let baseToken: Token | undefined = undefined;
    for (const maker of makers) {
      const baseTokenEntry = pLevels[maker]?.find(
        entry => entry.pair.baseToken.toLowerCase() === tokenAddress,
      );
      if (baseTokenEntry) {
        baseToken = {
          address: tokenAddress,
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

    const computeMaxLiquidity = (levels: PriceLevel[]): number => {
      const maxLevel = new BigNumber(levels[levels.length - 1]?.level ?? '0');
      return maxLevel.multipliedBy(baseTokenPriceUsd).toNumber();
    };

    const extractQuoteToken = (pair: {
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

    const pools = makers
      .map(
        m =>
          pLevels[m]
            ?.filter(
              entry => entry.pair.baseToken.toLowerCase() === tokenAddress,
            )
            .map(
              entry =>
                ({
                  exchange: this.dexKey,
                  address: this.routerAddress,
                  connectorTokens: [extractQuoteToken(entry.pair)],
                  liquidityUSD: computeMaxLiquidity(entry.levels),
                } as PoolLiquidity),
            ) ?? [],
      )
      .flatMap(pl => pl);

    return pools
      .sort((a, b) => b.liquidityUSD - a.liquidityUSD)
      .slice(0, limit);
  }
}
