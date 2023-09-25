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
import {
  SwapSide,
  Network,
  ETHER_ADDRESS,
  CACHE_PREFIX,
} from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getDexKeysWithNetwork, isAxiosError } from '../../utils';
import { IDex } from '../idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  NativeAPIParameters,
  NativeData,
  NativePriceLevel,
  NativePriceLevels,
  TokensMap,
} from './types';
import { SimpleExchange } from '../simple-exchange';
import { Adapters, NativeConfig } from './config';
import { RateFetcher } from './rate-fetcher';
import routerAbi from '../../abi/native/NativeRouter.abi.json';
import BigNumber from 'bignumber.js';
import { BN_0, BN_1, getBigNumberPow } from '../../bignumber-constants';
import { Interface } from 'ethers/lib/utils';
import { assert } from 'ts-essentials';
import {
  NATIVE_RFQ_PRICES_CACHES_TTL_S,
  NATIVE_RFQ_API_PRICES_POLLING_INTERVAL_MS,
  NATIVE_PRICES_CACHE_KEY,
  NATIVE_API_URL,
  NATIVE_PRICES_ENDPOINT,
  NATIVE_QUOTE_ENDPOINT,
  NATIVE_BLACKLIST_TTL_S,
  GAS_COST_ESTIMATION,
  NATIVE_TOKENS_POLLING_INTERVAL_MS,
  NATIVE_TOKENS_CACHES_TTL_S,
  NATIVE_TOKENS_CACHE_KEY,
  chainMap,
  NATIVE_MIN_SLIPPAGE_FACTOR_THRESHOLD_FOR_RESTRICTION,
  NATIVE_ORDER_TYPE_BUY,
  NATIVE_ORDER_TYPE_SELL,
} from './constants';
import { Method } from '../../dex-helper/irequest-wrapper';
import { BI_MAX_UINT256 } from '../../bigint-constants';
import {
  SlippageCheckError,
  TooStrictSlippageCheckError,
} from '../generic-rfq/types';

export class Native extends SimpleExchange implements IDex<NativeData> {
  readonly isStatePollingDex = true;
  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = false;
  readonly isFeeOnTransferSupported = false;
  private nativeApiKey: string;
  private rateFetcher: RateFetcher;
  private pricesCacheKey: string;
  private tokensMap: TokensMap = {};

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(NativeConfig);

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
    readonly routerAddress: string = NativeConfig['Native'][network]
      .routerAddress,
    protected routerInterface = new Interface(routerAbi),
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    const token = dexHelper.config.data.nativeAuthToken;
    assert(
      token !== undefined,
      'Native auth token is not specified with env variable',
    );

    this.nativeApiKey = token;

    this.pricesCacheKey = `${CACHE_PREFIX}_${this.dexHelper.config.data.network}_${this.dexKey}_prices`;

    this.rateFetcher = new RateFetcher(
      this.dexHelper,
      this.dexKey,
      this.logger,
      {
        rateConfig: {
          pricesIntervalMs: NATIVE_RFQ_API_PRICES_POLLING_INTERVAL_MS,
          pricesReqParams: this.getPriceLevelsReqParams(),
          pricesCacheTTLSecs: NATIVE_RFQ_PRICES_CACHES_TTL_S,
          pricesCacheKey: NATIVE_PRICES_CACHE_KEY,
        },
        tokensConfig: {
          tokensIntervalMs: NATIVE_TOKENS_POLLING_INTERVAL_MS,
          tokensReqParams: this.getTokensReqParams(),
          tokensCacheTTLSecs: NATIVE_TOKENS_CACHES_TTL_S,
          tokensCacheKey: NATIVE_TOKENS_CACHE_KEY,
        },
      },
    );
  }

  async initializePricing(blockNumber: number): Promise<void> {
    if (!this.dexHelper.config.isSlave) {
      await this.rateFetcher.start();
    }

    return;
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  getPairName = (srcAddress: Address, destAddress: Address) =>
    `${srcAddress}_${destAddress}`.toLowerCase();

  getIdentifierPrefix(srcAddress: Address, destAddress: Address) {
    return `${this.dexKey}_${this.getPairName(
      srcAddress,
      destAddress,
    )}`.toLowerCase();
  }

  getPoolIdentifier(srcAddress: Address, destAddress: Address) {
    return `${this.getIdentifierPrefix(srcAddress, destAddress)}`.toLowerCase();
  }

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    const normalizedSrcToken = this.normalizeToken(srcToken);
    const normalizedDestToken = this.normalizeToken(destToken);

    if (normalizedSrcToken.address === normalizedDestToken.address) {
      return [];
    }

    const poolIdentifier = this.getPoolIdentifier(
      normalizedSrcToken.address,
      normalizedDestToken.address,
    );

    const levels = await this.getCachedLevels();
    if (levels === null) {
      return [];
    }

    return Object.keys(levels)
      .map((pair: string) => {
        return this.getPoolIdentifier(levels[pair].base!, levels[pair].quote!);
      })
      .filter((pi: string) => pi === poolIdentifier);
  }

  computeLevelsQuote(
    amounts: BigNumber[],
    levels: NativePriceLevel[],
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
  ): bigint[] {
    const size = levels.length;
    if (size === 0) {
      return amounts.map(_ => BigInt(0));
    }

    return amounts.map((amount: BigNumber) => {
      if (amount.isZero()) {
        return BigInt(0);
      }

      let i = 0;
      let output = BN_0;
      let remaininig = BigNumber(amount);
      let enoughLiquidity = false;

      while (i < size) {
        const levelAmount = new BigNumber(levels[i].level);

        if (levelAmount.lte(remaininig)) {
          output = output.plus(levelAmount.times(levels[i].price));
          remaininig = remaininig.minus(levelAmount);
          i += 1;
        } else {
          output = output.plus(remaininig.times(levels[i].price));
          enoughLiquidity = true;
          break;
        }
      }
      if (enoughLiquidity) {
        return BigInt(
          output
            .multipliedBy(
              getBigNumberPow(
                side === SwapSide.BUY ? srcToken.decimals : destToken.decimals,
              ),
            )
            .toFixed(0),
        );
      }
      return BigInt(0); // not enough liquidity
    });
  }

  async getCachedLevels(): Promise<Record<string, NativePriceLevels> | null> {
    const cachedLevels = await this.dexHelper.cache.get(
      this.dexKey,
      this.network,
      NATIVE_PRICES_CACHE_KEY,
    );

    if (cachedLevels) {
      return JSON.parse(cachedLevels) as Record<string, NativePriceLevels>;
    }

    return null;
  }

  // Native protocol for native token expects 0x00000... instead of 0xeeeee...
  normalizeToken(token: Token): Token {
    return {
      address: token.address.toLowerCase(),
      decimals: token.decimals,
    };
  }

  inversePrice(priceLevel: NativePriceLevel): NativePriceLevel {
    return {
      level: priceLevel.level * priceLevel.price,
      price: 1 / priceLevel.price,
    };
  }

  invertPrices(levels: NativePriceLevel[]): NativePriceLevel[] {
    return levels.map(pl => this.inversePrice(pl));
  }

  computePricesFromLevelsBids(
    amounts: BigNumber[],
    asksAndBids: NativePriceLevels,
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
  ): bigint[] {
    let levels: NativePriceLevel[] = [];
    if (side === SwapSide.BUY) {
      if (destToken.address === asksAndBids.base!) {
        levels = asksAndBids.asks;
      } else {
        levels = this.invertPrices(asksAndBids.bids);
      }
    } else {
      if (srcToken.address === asksAndBids.base!) {
        levels = asksAndBids.bids;
      } else {
        levels = this.invertPrices(asksAndBids.asks);
      }
    }

    const firstLevelRaw = levels[0];
    const firstLevelAmountBN = new BigNumber(firstLevelRaw.level);

    if (amounts[amounts.length - 1].lt(firstLevelAmountBN)) {
      return [];
    }

    return this.computeLevelsQuote(amounts, levels, srcToken, destToken, side);
  }

  async getCachedTokens(): Promise<TokensMap | null> {
    const cachedTokens = await this.dexHelper.cache.get(
      this.dexKey,
      this.network,
      NATIVE_TOKENS_CACHE_KEY,
    );

    if (cachedTokens) {
      return JSON.parse(cachedTokens) as TokensMap;
    }

    return null;
  }

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<NativeData>> {
    try {
      const normalizedSrcToken = this.normalizeToken(srcToken);
      const normalizedDestToken = this.normalizeToken(destToken);

      this.tokensMap = (await this.getCachedTokens()) || {};

      if (normalizedSrcToken.address === normalizedDestToken.address) {
        return null;
      }

      const requestedPoolIdentifier: string = this.getPoolIdentifier(
        normalizedSrcToken.address,
        normalizedDestToken.address,
      );

      const pools = limitPools
        ? limitPools.filter(
            p =>
              p ===
                this.getPoolIdentifier(
                  normalizedSrcToken.address,
                  normalizedDestToken.address,
                ) ||
              p ===
                this.getPoolIdentifier(
                  normalizedDestToken.address,
                  normalizedSrcToken.address,
                ),
          )
        : await this.getPoolIdentifiers(srcToken, destToken, side, blockNumber);

      const levels = (await this.getCachedLevels()) || {};
      if (levels === null) {
        return null;
      }

      const levelEntries: NativePriceLevels[] = Object.keys(levels)
        .filter(pair => {
          const { base, quote } = levels[pair];
          if (
            pools.includes(this.getPoolIdentifier(quote, base)) ||
            pools.includes(this.getPoolIdentifier(base, quote))
          ) {
            return true;
          }

          return false;
        })
        .map(pair => {
          return levels[pair];
        });

      const unitVolume = getBigNumberPow(
        (side === SwapSide.SELL ? normalizedSrcToken : normalizedDestToken)
          .decimals,
      );

      const amountsFloat = amounts.map(a =>
        new BigNumber(a.toString()).dividedBy(unitVolume),
      );

      const prices = levelEntries.map((askAndBids: NativePriceLevels) => {
        const unitPrice: bigint | undefined = this.computePricesFromLevelsBids(
          [unitVolume],
          askAndBids,
          normalizedSrcToken,
          normalizedDestToken,
          side,
        )[0];

        const prices = this.computePricesFromLevelsBids(
          amountsFloat,
          askAndBids,
          normalizedSrcToken,
          normalizedDestToken,
          side,
        );

        if (!prices.length) {
          return null;
        }

        return {
          gasCost: GAS_COST_ESTIMATION,
          exchange: this.dexKey,
          data: {},
          prices,
          unit: unitPrice === undefined ? 0n : unitPrice,
          poolIdentifier: requestedPoolIdentifier,
        } as PoolPrices<NativeData>;
      });

      return prices.filter((p): p is PoolPrices<NativeData> => !!p);
    } catch (e) {
      this.logger.error(
        `Error_getPrices ${srcToken}, ${destToken}, ${side}:`,
        e,
      );
      return null;
    }
  }

  async preProcessTransaction(
    optimalSwapExchange: OptimalSwapExchange<NativeData>,
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    options: PreprocessTransactionOptions,
  ): Promise<[OptimalSwapExchange<NativeData>, ExchangeTxInfo]> {
    if (await this.isBlacklisted(options.txOrigin)) {
      this.logger.warn(
        `${this.dexKey}-${this.network}: blacklisted TX Origin address '${options.txOrigin}' trying to build a transaction. Bailing...`,
      );
      throw new Error(
        `${this.dexKey}-${
          this.network
        }: user=${options.txOrigin.toLowerCase()} is blacklisted`,
      );
    }

    const isSell = side === SwapSide.SELL;

    const normalizedSrcToken = this.normalizeToken(srcToken);
    const normalizedDestToken = this.normalizeToken(destToken);

    try {
      const quote = await this.rateFetcher.getQuote(
        this.network,
        normalizedSrcToken,
        normalizedDestToken,
        isSell ? optimalSwapExchange.srcAmount : optimalSwapExchange.destAmount,
        this.augustusAddress,
        this.getQuoteReqParams(),
      );

      if (!quote.calldata) {
        const message = `${this.dexKey}-${this.network}: Failed to fetch RFQ for ${normalizedSrcToken.address}_${normalizedDestToken.address}. Missing quote data`;
        this.logger.warn(message);
        throw new Error(message);
      } else if (!quote.to) {
        const message = `${this.dexKey}-${this.network}: Failed to fetch RFQ for ${normalizedSrcToken.address}_${normalizedDestToken.address}. Missing router address`;
        this.logger.warn(message);
        throw new Error(message);
      }

      return [
        {
          ...optimalSwapExchange,
          data: {
            from: quote.from,
            to: quote.to,
            calldata: quote.calldata,
            struct: quote.struct,
          },
        },
        { deadline: BI_MAX_UINT256 },
      ];
    } catch (e) {
      if (
        isAxiosError(e) &&
        (e.response?.status === 403 || e.response?.status === 429)
      ) {
        await this.setBlacklist(options.txOrigin);
        this.logger.warn(
          `${this.dexKey}-${this.network}: Encountered restricted user=${options.txOrigin}. Adding to local blacklist cache`,
        );
      } else {
        if (e instanceof TooStrictSlippageCheckError) {
          this.logger.warn(
            `${this.dexKey}-${this.network}: failed to build transaction on side ${side} with too strict slippage. Skipping restriction`,
          );
        } else {
          this.logger.warn(
            `${this.dexKey}-${this.network}: protocol is restricted`,
          );
          // await this.restrict();
        }
      }

      throw e;
    }
  }

  getCalldataGasCost(poolPrices: PoolPrices<NativeData>): number | number[] {
    return (
      CALLDATA_GAS_COST.DEX_OVERHEAD +
      // order
      CALLDATA_GAS_COST.FULL_WORD +
      CALLDATA_GAS_COST.ADDRESS +
      CALLDATA_GAS_COST.ADDRESS +
      CALLDATA_GAS_COST.ADDRESS +
      CALLDATA_GAS_COST.ADDRESS +
      CALLDATA_GAS_COST.ADDRESS +
      CALLDATA_GAS_COST.FULL_WORD +
      CALLDATA_GAS_COST.FULL_WORD +
      CALLDATA_GAS_COST.FULL_WORD +
      CALLDATA_GAS_COST.ADDRESS +
      CALLDATA_GAS_COST.UUID +
      // recipient
      CALLDATA_GAS_COST.ADDRESS +
      // amountOutMinimum
      CALLDATA_GAS_COST.FULL_WORD +
      // widgetFee
      CALLDATA_GAS_COST.ADDRESS +
      CALLDATA_GAS_COST.FULL_WORD +
      CALLDATA_GAS_COST.FULL_WORD +
      CALLDATA_GAS_COST.ADDRESS +
      // widgetFeeSignature
      CALLDATA_GAS_COST.FULL_WORD +
      CALLDATA_GAS_COST.FULL_WORD +
      CALLDATA_GAS_COST.OFFSET_SMALL +
      // fallback array
      CALLDATA_GAS_COST.FULL_WORD
    );
  }

  getTokenFromAddress(address: Address): Token {
    return this.tokensMap[address.toLowerCase()];
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: NativeData,
    side: SwapSide,
  ): AdapterExchangeParam {
    const { calldata } = data;

    return {
      targetExchange: this.routerAddress,
      payload: calldata,
      networkFee: '0',
    };
  }

  getBlackListKey(address: Address) {
    return `blacklist_${address}`.toLowerCase();
  }

  async isBlacklisted(txOrigin: Address): Promise<boolean> {
    const result = await this.dexHelper.cache.get(
      this.dexKey,
      this.network,
      this.getBlackListKey(txOrigin),
    );
    return result === 'blacklisted';
  }

  async setBlacklist(txOrigin: Address, ttl: number = NATIVE_BLACKLIST_TTL_S) {
    await this.dexHelper.cache.setex(
      this.dexKey,
      this.network,
      this.getBlackListKey(txOrigin),
      ttl,
      'blacklisted',
    );
    return true;
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: NativeData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const { to, calldata } = data;

    assert(
      to !== undefined,
      `${this.dexKey}-${this.network}: router undefined`,
    );

    assert(
      calldata !== undefined,
      `${this.dexKey}-${this.network}: callData undefined`,
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      calldata,
      to,
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
    levels: NativePriceLevels,
    tokenAddress: string,
  ): number => {
    // Helper function to compute total liquidity from an array of price levels
    const computeLiquidityFromLevels = (levelArray: NativePriceLevel[]) => {
      return levelArray.reduce((acc, curr) => acc + curr.level, 0);
    };

    if (tokenAddress === levels.base) {
      return computeLiquidityFromLevels(levels.asks);
    }
    return computeLiquidityFromLevels(levels.bids);
  };

  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    this.tokensMap = (await this.getCachedTokens()) || {};

    const normalizedTokenAddress = tokenAddress.toLowerCase();

    const pLevels = await this.getCachedLevels();

    if (pLevels === null) {
      return [];
    }

    return Object.keys(pLevels)
      .filter((pair: string) => {
        const { base, quote } = pLevels[pair];

        return (
          normalizedTokenAddress === base || normalizedTokenAddress === quote
        );
      })
      .map((pair: string) => {
        return {
          exchange: this.dexKey,
          connectorTokens: [
            this.getTokenFromAddress(
              normalizedTokenAddress === pLevels[pair].base
                ? pLevels[pair].quote
                : pLevels[pair].base,
            ),
          ],
          liquidityUSD: this.computeMaxLiquidity(pLevels[pair], tokenAddress),
        } as PoolLiquidity;
      })
      .sort((pl: PoolLiquidity) => {
        return -pl.liquidityUSD;
      })
      .slice(0, limit);
  }

  releaseResources(): void {
    if (this.rateFetcher) {
      this.rateFetcher.stop();
    }
  }

  getPriceLevelsReqParams(): NativeAPIParameters {
    return this.getAPIReqParams(NATIVE_PRICES_ENDPOINT, 'GET');
  }

  getQuoteReqParams(): NativeAPIParameters {
    return this.getAPIReqParams(NATIVE_QUOTE_ENDPOINT, 'POST');
  }

  getTokensReqParams(): NativeAPIParameters {
    return {
      url: `${NATIVE_API_URL}/tokens`,
      params: {
        chain: chainMap[this.network],
      },
      headers: { apiKey: this.nativeApiKey },
      method: 'GET',
    };
  }

  getAPIReqParams(endpoint: string, method: Method): NativeAPIParameters {
    return {
      url: `${NATIVE_API_URL}/aggregator/paraswap/${endpoint}`,
      params: {
        chain_id: this.network,
      },
      headers: { apiKey: this.nativeApiKey },
      method: method,
    };
  }
}
