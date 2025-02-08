import {
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  PoolLiquidity,
  DexExchangeParam,
  NumberAsString,
} from '../../types';
import {
  SwapSide,
  Network,
  FETCH_POOL_IDENTIFIER_TIMEOUT,
  FETCH_POOL_PRICES_TIMEOUT,
  ETHER_ADDRESS,
} from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getBigIntPow, getDexKeysWithNetwork } from '../../utils';
import { Context, IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  EkuboData,
  GetQuoteDataResponse,
  PoolKey,
  PoolState,
  VanillaPoolParameters,
} from './types';
import { SimpleExchange } from '../simple-exchange';
import { EkuboConfig } from './config';
import { BasePool, BasePool as EkuboEventPool } from './pools/base-pool';
import {
  convertEkuboToParaSwap,
  convertParaSwapToEkubo,
  hexStringTokenPair,
  ORACLE_TOKEN_ADDRESS,
  sortAndConvertTokens,
} from './utils';
import Joi from 'joi';
import { Interface } from '@ethersproject/abi';

import CoreABI from '../../abi/ekubo/core.json';
import DataFetcherABI from '../../abi/ekubo/data-fetcher.json';
import { BigNumber, constants, Contract } from 'ethers';
import { setTimeout } from 'node:timers/promises';
import {
  MAX_SQRT_RATIO,
  MAX_TICK_SPACING,
  MIN_SQRT_RATIO,
} from './pools/math/tick';
import { hexlify } from 'ethers/lib/utils';
import SimpleSwapperABI from '../../abi/ekubo/simple-swapper.json';
import { isPriceIncreasing } from './pools/math/swap';
import { OraclePool } from './pools/oracle-pool';
import { erc20Iface } from '../../lib/tokens/utils';

// TODO
const ENABLED_POOL_PARAMETERS: VanillaPoolParameters[] = [
  {
    fee: 0n,
    tickSpacing: 1,
  },
];

type PairInfo = {
  fee: string;
  tick_spacing: number;
  extension: string;
  tvl0_total: string;
  tvl1_total: string;
};

const tokenPairSchema = Joi.object<{
  topPools: PairInfo[];
}>({
  topPools: Joi.array().items(
    Joi.object({
      fee: Joi.string(),
      tick_spacing: Joi.number(),
      extension: Joi.string(),
      tvl0_total: Joi.string(),
      tvl1_total: Joi.string(),
    }),
  ),
});

const topPairsSchema = Joi.object<{
  topPairs: {
    token0: string;
    token1: string;
    tvl0_total: string;
    tvl1_total: string;
  }[];
}>({
  topPairs: Joi.array().items(
    Joi.object({
      token0: Joi.string(),
      token1: Joi.string(),
      tvl0_total: Joi.string(),
      tvl1_total: Joi.string(),
    }),
  ),
});

// TODO
const MIN_TICK_SPACINGS_PER_POOL = 10;
const MAX_POOL_BATCH_COUNT = 10;

/**
 * Ekubo Protocol https://ekubo.org/
 *
 * Potential improvements:
 * - Use subgraphs instead of the Ekubo API
 */
export class Ekubo extends SimpleExchange implements IDex<EkuboData> {
  protected readonly eventPools: Record<string, EkuboEventPool> = {};

  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = false;
  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(EkuboConfig);

  private readonly pools: Map<string, BasePool> = new Map();

  public logger;

  private readonly config;
  private readonly core;
  private readonly coreIface;
  private readonly dataFetcher;
  private readonly swapperIface;
  private readonly supportedExtension;

  private readonly decimals: Record<string, number> = {
    [ETHER_ADDRESS]: 18,
  };

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
  ) {
    super(dexHelper, dexKey);

    this.logger = dexHelper.getLogger(dexKey);
    this.config = EkuboConfig[dexKey][network];
    this.core = new Contract(this.config.core, CoreABI, dexHelper.provider);
    this.coreIface = new Interface(CoreABI);
    this.dataFetcher = new Contract(
      this.config.dataFetcher,
      DataFetcherABI,
      dexHelper.provider,
    );
    this.swapperIface = new Interface(SimpleSwapperABI);
    this.supportedExtension = [0n, this.config.oracle];
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(_blockNumber: number) {}

  // Legacy: was only used for V5
  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(_side: SwapSide): { name: string; index: number }[] | null {
    return null;
  }

  // Returns list of pool identifiers that can be used
  // for a given swap. poolIdentifiers must be unique
  // across DEXes. It is recommended to use
  // ${dexKey}_${poolAddress} as a poolIdentifier
  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    _side: SwapSide,
    _blockNumber: number,
  ): Promise<string[]> {
    return this.fetchPools(srcToken, destToken, FETCH_POOL_IDENTIFIER_TIMEOUT);
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
  ): Promise<null | ExchangePrices<EkuboData>> {
    limitPools ??= await this.fetchPools(
      srcToken,
      destToken,
      blockNumber,
      FETCH_POOL_PRICES_TIMEOUT,
    );

    const isExactOut = side === SwapSide.BUY;

    const amountToken = isExactOut ? destToken : srcToken;
    const amountTokenAddress = convertParaSwapToEkubo(amountToken.address);
    const unitAmount = getBigIntPow(amountToken.decimals);

    const [token0, token1] = sortAndConvertTokens(srcToken, destToken);

    const exchangePrices = [];

    // eslint-disable-next-line no-restricted-syntax
    poolLoop: for (const poolId of limitPools) {
      const pool = this.pools.get(poolId);

      if (typeof pool === 'undefined') {
        this.logger.warn(`Pool ${poolId} not found`);
        continue;
      }

      if (pool.key.token0 !== token0 || pool.key.token1 !== token1) {
        this.logger.error(
          `Can't quote pair ${hexStringTokenPair(
            token0,
            token1,
          )} on pool ${poolId}`,
        );
        continue;
      }

      try {
        const quotes = [];

        for (const amount of [unitAmount, ...amounts]) {
          const inputAmount = isExactOut ? -amount : amount;

          const quote = pool.quote(
            inputAmount,
            amountTokenAddress,
            blockNumber,
          );

          if (isExactOut && quote.consumedAmount !== inputAmount) {
            this.logger.debug(
              "Pool doesn't have enough liquidity to support exact-out swap",
            );

            // There doesn't seem to be a way to skip just this one price.
            // Anyway, this pool is probably not the right one if it has such thin liquidity.
            continue poolLoop;
          }

          quotes.push(quote);
        }

        const [unitQuote, ...otherQuotes] = quotes;

        // console.log(unitQuote, quotes);

        exchangePrices.push({
          prices: otherQuotes.map(quote => quote.calculatedAmount),
          unit: unitQuote.calculatedAmount,
          data: {
            poolKey: pool.key,
            isToken1: amountTokenAddress === token1,
          },
          poolIdentifier: poolId,
          exchange: this.dexKey,
          gasCost: otherQuotes.map(quote => quote.gasConsumed),
        });
      } catch (err) {
        this.logger.error('Quote error:', err);
        continue;
      }
    }

    return exchangePrices.length === 0 ? null : exchangePrices;
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(_poolPrices: PoolPrices<EkuboData>): number | number[] {
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  // V6: Not used, can be left blank
  getAdapterParam(
    _srcToken: string,
    _destToken: string,
    _srcAmount: string,
    _destAmount: string,
    _data: EkuboData,
    _side: SwapSide,
  ): AdapterExchangeParam {
    return {
      targetExchange: this.dexKey,
      payload: '',
      networkFee: '0',
    };
  }

  async updatePoolState(): Promise<void> {}

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    const topPairsUrl = `${this.config.apiUrl}/overview/pairs`;
    const topPairsRes = await this.dexHelper.httpRequest.get(topPairsUrl);

    const { error, value } = topPairsSchema.validate(topPairsRes, {
      allowUnknown: true,
      presence: 'required',
    });

    if (typeof error !== 'undefined') {
      throw new Error(`validating API response from ${topPairsUrl}: ${error}`);
    }

    const poolLiquidities: PoolLiquidity[] = [];

    await Promise.allSettled(
      value.topPairs.map(pair =>
        (async () => {
          if (pair.tvl0_total === '0' && pair.tvl1_total === '0') {
            return;
          }

          const tokenPair = [BigInt(pair.token0), BigInt(pair.token1)];
          const [token0, token1] = tokenPair;

          if (!tokenPair.includes(convertParaSwapToEkubo(tokenAddress))) {
            return;
          }

          const pairsInfo = await this.fetchPairPools(
            hexStringTokenPair(token0, token1),
          );

          for (const pairInfo of pairsInfo) {
            const [info0, info1] = await Promise.all(
              tokenPair.map((ekuboToken, i) =>
                (async () => {
                  const paraswapToken = convertEkuboToParaSwap(ekuboToken);
                  const decimals = await this.getDecimals(paraswapToken);

                  const token = {
                    address: paraswapToken,
                    decimals,
                  };

                  return {
                    token,
                    tvl: await this.dexHelper.getTokenUSDPrice(
                      token,
                      BigInt(pairInfo[`tvl${i as 0 | 1}_total`]),
                    ),
                  };
                })(),
              ),
            );

            poolLiquidities.push({
              exchange: this.dexKey,
              address: this.config.core,
              connectorTokens: [
                (info0.token.address !== tokenAddress ? info0 : info1).token,
              ],
              liquidityUSD: info0.tvl + info1.tvl,
            });
          }
        })(),
      ),
    );

    poolLiquidities
      .sort((a, b) => a.liquidityUSD - b.liquidityUSD)
      .splice(limit, Infinity);

    return poolLiquidities;
  }

  private async getDecimals(paraswapToken: string): Promise<number> {
    const cached = this.decimals[paraswapToken];
    if (typeof cached === 'number') {
      return cached;
    }

    const decimals: number = new Contract(
      paraswapToken,
      erc20Iface,
      this.dexHelper.provider,
    ).decimals();

    this.decimals[paraswapToken] = decimals;

    return decimals;
  }

  getDexParam(
    _srcToken: Address,
    _destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    _recipient: Address,
    data: EkuboData,
    side: SwapSide,
    _context: Context,
    _executorAddress: Address,
  ): DexExchangeParam {
    const amount = BigInt(side === SwapSide.BUY ? `-${destAmount}` : srcAmount);

    return {
      needWrapNative: this.needWrapNative,
      exchangeData: this.swapperIface.encodeFunctionData('swap', [
        data.poolKey.toAbi(),
        data.isToken1,
        BigNumber.from(amount),
        isPriceIncreasing(amount, data.isToken1)
          ? MAX_SQRT_RATIO
          : MIN_SQRT_RATIO,
        constants.Zero, // TODO
      ]),
      targetExchange: this.config.swapper,
      dexFuncHasRecipient: false,
      returnAmountPos: undefined,
    };
  }

  private async fetchPools(
    tokenA: Token,
    tokenB: Token,
    blockNumber: number,
    maxTime?: number,
  ): Promise<string[]> {
    const [token0, token1] = sortAndConvertTokens(tokenA, tokenB);
    const pair = hexStringTokenPair(token0, token1);

    if (typeof maxTime === 'number') {
      // Leave some time for computations & timer inaccuracies
      maxTime -= 50;
    }

    let poolKeys: PoolKey[];
    try {
      poolKeys = (
        await this.fetchPairPools(
          pair,
          typeof maxTime === 'undefined' ? maxTime : maxTime / 2,
        )
      ).map(
        pool =>
          new PoolKey(
            token0,
            token1,
            BigInt(pool.fee),
            pool.tick_spacing,
            BigInt(pool.extension),
          ),
      );
    } catch (err) {
      this.logger.error(
        `Fetching pools from Ekubo API for token pair ${pair} failed, falling back to default pool parameters: ${err}`,
      );

      poolKeys = ENABLED_POOL_PARAMETERS.map(
        params =>
          new PoolKey(token0, token1, params.fee, params.tickSpacing, 0n),
      );

      if ([token0, token1].includes(ORACLE_TOKEN_ADDRESS)) {
        poolKeys.push(
          new PoolKey(
            token0,
            token1,
            0n,
            MAX_TICK_SPACING,
            BigInt(this.config.oracle),
          ),
        );
      }
    }

    // TODO Make sure that we haven't initialized these pools before

    const promises = [];

    for (
      let batchStart = 0;
      batchStart < poolKeys.length;
      batchStart += MAX_POOL_BATCH_COUNT
    ) {
      const batch = poolKeys.slice(
        batchStart,
        batchStart + MAX_POOL_BATCH_COUNT,
      );

      promises.push(
        Promise.race([
          ...(maxTime
            ? [
                setTimeout(maxTime / 2).then(() => {
                  throw new Error('Timeout');
                }),
              ]
            : []), // TODO Timeout
          (async () => {
            const fetchedData: GetQuoteDataResponse =
              await this.dataFetcher.getQuoteData(
                batch.map(poolKey => poolKey.toAbi()),
                MIN_TICK_SPACINGS_PER_POOL,
              );

            return Promise.all(
              fetchedData.map(async (data, i) => {
                const initialState = PoolState.fromQuoter(data);

                const poolKey = poolKeys[batchStart + i];
                const poolId = poolKey.id();
                const extension = poolKey.extension;

                let poolConstructor;
                if (extension === 0n) {
                  poolConstructor = BasePool;
                } else if (extension === BigInt(this.config.oracle)) {
                  poolConstructor = OraclePool;
                } else {
                  throw new Error(
                    `Unknown pool extension ${hexlify(extension)}`,
                  );
                }

                const pool = new poolConstructor(
                  this.dexKey,
                  this.network,
                  this.dexHelper,
                  this.logger,
                  this.core,
                  this.coreIface,
                  this.dataFetcher,
                  poolKey,
                );

                this.pools.set(poolId, pool);

                // This is fulfilled immediately
                await pool.initialize(blockNumber, { state: initialState });

                return poolId;
              }),
            );
          })(),
        ]).catch(err => {
          throw {
            batch,
            err,
          };
        }),
      );
    }

    return (await Promise.allSettled(promises)).flatMap(res => {
      if (res.status === 'rejected') {
        this.logger.error(
          `Fetching batch failed. Pool keys: ${res.reason.batch}. Error: ${res.reason.err}`,
        );
        return [];
      } else {
        return res.value;
      }
    });
  }

  private async fetchPairPools(
    pair: string,
    maxTime?: number,
  ): Promise<PairInfo[]> {
    const res = await this.dexHelper.httpRequest.get(
      `${this.config.apiUrl}/pair/${pair}/pools`,
      typeof maxTime === 'undefined' ? maxTime : maxTime / 2,
    );

    const { error, value } = tokenPairSchema.validate(res, {
      allowUnknown: true,
      presence: 'required',
    });

    if (typeof error !== 'undefined') {
      throw new Error(`validating API response: ${error}`);
    }

    return value.topPools.filter(
      res =>
        this.supportedExtension.includes(BigInt(res.extension)) &&
        (res.tvl0_total !== '0' || res.tvl1_total !== '0'),
    );
  }
}
