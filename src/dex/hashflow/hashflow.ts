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
import { SwapSide, Network } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { HashflowData, PriceLevel, RfqError } from './types';
import { SimpleExchange } from '../simple-exchange';
import { HashflowConfig, Adapters } from './config';
import { HashflowApi } from '@hashflow/taker-js';
import routerAbi from '../../abi/hashflow/HashflowRouter.abi.json';
import BigNumber from 'bignumber.js';
import { BN_0, BN_1, getBigNumberPow } from '../../bignumber-constants';
import { Interface } from 'ethers/lib/utils';
import { ChainId, ZERO_ADDRESS } from '@hashflow/sdk';

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
    const pair = { baseToken: srcToken, quoteToken: destToken };
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

  calculatePricesFromLevels(
    amounts: BigNumber[],
    levels: PriceLevel[],
    decimals: number,
  ): bigint[] {
    let lastOrderIndex = 0;
    let lastTotalSrcAmount = BN_0;
    let lastTotalDestAmount = BN_0;
    const outputs = new Array<BigNumber>(amounts.length).fill(BN_0);
    for (const [i, amount] of amounts.entries()) {
      if (amount.isZero()) {
        outputs[i] = BN_0;
      } else {
        let srcAmountLeft = amount.minus(lastTotalSrcAmount);
        let destAmountFilled = lastTotalDestAmount;
        while (lastOrderIndex < levels.length) {
          const { price, level } = levels[lastOrderIndex];
          if (srcAmountLeft.gt(level)) {
            const destAmount = new BigNumber(level).multipliedBy(price);

            srcAmountLeft = srcAmountLeft.minus(level);
            destAmountFilled = destAmountFilled.plus(destAmount);

            lastTotalSrcAmount = lastTotalSrcAmount.plus(level);
            lastTotalDestAmount = lastTotalDestAmount.plus(destAmount);
            lastOrderIndex++;
          } else {
            destAmountFilled = destAmountFilled.plus(
              srcAmountLeft.multipliedBy(price),
            );
            srcAmountLeft = BN_0;
            break;
          }
        }
        if (srcAmountLeft.isZero()) {
          outputs[i] = destAmountFilled;
        } else {
          // If current amount was unfillable, then bigger amounts are unfillable as well
          break;
        }
      }
    }

    return outputs.map(o =>
      BigInt(o.multipliedBy(getBigNumberPow(decimals)).toFixed(0)),
    );
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
    const pair = { baseToken: srcToken, quoteToken: destToken };
    const prefix = `${this.dexKey}_${this.getPairName(pair)}`;

    // Check cached price levels
    const pricesAsString = await this.dexHelper.cache.get(
      this.dexKey,
      chainId,
      prefix,
    );
    if (pricesAsString) {
      return JSON.parse(pricesAsString) as ExchangePrices<HashflowData>;
    }

    const pools =
      limitPools ??
      (await this.getPoolIdentifiers(srcToken, destToken, side, blockNumber));
    const makers = pools.map(p => p.split(prefix).pop()!);

    const levelsMap = await this.api.getPriceLevels(chainId, makers);
    const prices = Object.keys(levelsMap)
      .map(mm => {
        const entry = levelsMap[mm]?.find(
          e =>
            `${e.pair.baseToken}_${e.pair.quoteToken}` ===
            this.getPairName(pair),
        );
        if (entry === undefined) {
          return undefined;
        }

        const amountsRaw = amounts.map(a =>
          new BigNumber(a.toString()).dividedBy(
            getBigNumberPow(pair.baseToken.decimals),
          ),
        );
        const outDecimals = pair.quoteToken.decimals;

        const unitPrice = this.calculatePricesFromLevels(
          [BN_1],
          entry.levels,
          outDecimals,
        )[0];
        const prices = this.calculatePricesFromLevels(
          amountsRaw,
          entry.levels,
          outDecimals,
        );

        return {
          gasCost: 100_000,
          exchange: this.dexKey,
          prices,
          unit: unitPrice,
          poolIdentifier: `${prefix}_${mm}`,
          poolAddresses: [this.routerAddress],
        } as PoolPrices<HashflowData>;
      })
      .filter(o => o !== undefined)
      .map(o => o as PoolPrices<HashflowData>);

    await this.dexHelper.cache.setex(
      this.dexKey,
      chainId,
      prefix,
      PRICE_LEVELS_TTL_SECONDS,
      JSON.stringify(prices),
    );

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
    const pair = { baseToken: srcToken, quoteToken: destToken };
    const baseTokenAmount = optimalSwapExchange.srcAmount;
    const quoteTokenAmount = optimalSwapExchange.destAmount;

    const rfq = await this.api.requestQuote({
      chainId,
      baseToken: pair.baseToken.address,
      quoteToken: pair.quoteToken.address,
      ...(side === SwapSide.SELL ? { baseTokenAmount } : { quoteTokenAmount }),
      wallet: this.augustusAddress,
      effectiveTrader: options.txOrigin,
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

    const paramType =
      this.routerInterface.getFunction('tradeSingleHop').inputs[0];

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
      srcAmount,
      destToken,
      destAmount,
      swapData,
      this.dexKey,
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
      1n,
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

    return pools;
  }
}
