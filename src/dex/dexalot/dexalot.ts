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
  ClobSide,
  DexalotData,
  PairData,
  PairDataMap,
  PriceDataMap,
  RfqError,
  RFQResponse,
  RFQResponseError,
  SlippageCheckError,
  TokenAddrDataMap,
  TokenDataMap,
} from './types';
import { SimpleExchange } from '../simple-exchange';
import { Adapters, DexalotConfig } from './config';
import { RateFetcher } from './rate-fetcher';
import mainnetRFQAbi from '../../abi/dexalot/DexalotMainnetRFQ.json';
import { Interface } from 'ethers/lib/utils';
import { assert } from 'ts-essentials';
import {
  DEXALOT_API_URL,
  DEXALOT_API_PRICES_POLLING_INTERVAL_MS,
  DEXALOT_PRICES_CACHES_TTL_S,
  DEXALOT_GAS_COST,
  DEXALOT_PAIRS_CACHES_TTL_S,
  DEXALOT_API_PAIRS_POLLING_INTERVAL_MS,
  DEXALOT_TOKENS_CACHES_TTL_S,
  DEXALOT_API_BLACKLIST_POLLING_INTERVAL_MS,
  DEXALOT_RATE_LIMITED_TTL_S,
} from './constants';
import { BI_MAX_UINT256 } from '../../bigint-constants';
import { ethers } from 'ethers';
import BigNumber from 'bignumber.js';

export class Dexalot extends SimpleExchange implements IDex<DexalotData> {
  readonly isStatePollingDex = true;
  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = false;
  readonly isFeeOnTransferSupported = false;
  private rateFetcher: RateFetcher;

  private dexalotAuthToken: string;

  private pricesCacheKey: string;
  private pairsCacheKey: string;
  private tokensAddrCacheKey: string;
  private tokensCacheKey: string;
  private blacklistCacheKey: string;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(DexalotConfig);

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
    readonly mainnetRFQAddress: string = DexalotConfig['Dexalot'][network]
      .mainnetRFQAddress,
    protected rfqInterface = new Interface(mainnetRFQAbi),
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);

    const authToken = dexHelper.config.data.dexalotAuthToken;
    assert(
      authToken !== undefined,
      'Dexalot auth token is not specified with env variable',
    );
    this.dexalotAuthToken = authToken;

    this.pricesCacheKey = `${CACHE_PREFIX}_prices`;
    this.pairsCacheKey = `${CACHE_PREFIX}_pairs`;
    this.tokensAddrCacheKey = `${CACHE_PREFIX}_tokens_addr`;
    this.tokensCacheKey = `${CACHE_PREFIX}_tokens`;
    this.blacklistCacheKey = `${CACHE_PREFIX}_blacklist`;

    this.rateFetcher = new RateFetcher(
      this.dexHelper,
      this.dexKey,
      this.network,
      this.logger,
      {
        rateConfig: {
          pairsIntervalMs: DEXALOT_API_PAIRS_POLLING_INTERVAL_MS,
          pricesIntervalMs: DEXALOT_API_PRICES_POLLING_INTERVAL_MS,
          blacklistIntervalMs: DEXALOT_API_BLACKLIST_POLLING_INTERVAL_MS,
          pairsReqParams: {
            url: `${DEXALOT_API_URL}/api/rfq/pairs`,
            headers: {
              'x-apikey': this.dexalotAuthToken,
            },
            params: {
              chainid: this.network,
            },
          },
          pricesReqParams: {
            url: `${DEXALOT_API_URL}/api/rfq/prices`,
            headers: {
              'x-apikey': this.dexalotAuthToken,
            },
            params: {
              chainid: this.network,
            },
          },
          blacklistReqParams: {
            url: `${DEXALOT_API_URL}/api/rfq/blacklist`,
            headers: {
              'x-apikey': this.dexalotAuthToken,
            },
          },
          pairsCacheKey: this.pairsCacheKey,
          pairsCacheTTLSecs: DEXALOT_PAIRS_CACHES_TTL_S,
          pricesCacheKey: this.pricesCacheKey,
          pricesCacheTTLSecs: DEXALOT_PRICES_CACHES_TTL_S,
          tokensAddrCacheKey: this.tokensAddrCacheKey,
          tokensCacheKey: this.tokensCacheKey,
          tokensCacheTTLSecs: DEXALOT_TOKENS_CACHES_TTL_S,
          blacklistCacheKey: this.blacklistCacheKey,
        },
      },
    );
  }

  async initializePricing(blockNumber: number): Promise<void> {
    if (!this.dexHelper.config.isSlave) {
      this.rateFetcher.start();
    }

    return;
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  getPairString(baseToken: Token, quoteToken: Token): string {
    return `${baseToken.symbol}/${quoteToken.symbol}`.toLowerCase();
  }

  async getPairData(
    srcToken: Token,
    destToken: Token,
  ): Promise<PairData | null> {
    const normalizedSrcToken = this.normalizeToken(srcToken);
    const normalizedDestToken = this.normalizeToken(destToken);
    if (normalizedSrcToken.address === normalizedDestToken.address) {
      return null;
    }

    const cachedTokens = (await this.getCachedTokens()) || {};
    if (
      !(normalizedSrcToken.address in cachedTokens) ||
      !(normalizedDestToken.address in cachedTokens)
    ) {
      return null;
    }
    normalizedSrcToken.symbol = cachedTokens[normalizedSrcToken.address].symbol;
    normalizedDestToken.symbol =
      cachedTokens[normalizedDestToken.address].symbol;

    const cachedPairs = (await this.getCachedPairs()) || {};

    const potentialPairs = [
      {
        identifier: this.getPairString(normalizedSrcToken, normalizedDestToken),
        isSrcBase: true,
      },
      {
        identifier: this.getPairString(normalizedDestToken, normalizedSrcToken),
        isSrcBase: false,
      },
    ];

    for (const pair of potentialPairs) {
      if (pair.identifier in cachedPairs) {
        const pairData = cachedPairs[pair.identifier];
        pairData.isSrcBase = pair.isSrcBase;
        return pairData;
      }
    }
    return null;
  }

  getIdentifier(baseSymbol: string, quoteSymbol: string) {
    return `${this.dexKey}_${baseSymbol}_${quoteSymbol}`.toLowerCase();
  }

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    if (!srcToken || !destToken) {
      return [];
    }
    const pairData = await this.getPairData(srcToken, destToken);
    if (!pairData) {
      return [];
    }
    return [this.getIdentifier(pairData.base, pairData.quote)];
  }

  async getCachedPairs(): Promise<PairDataMap | null> {
    const cachedPairs = await this.dexHelper.cache.get(
      this.dexKey,
      this.network,
      this.pairsCacheKey,
    );

    if (cachedPairs) {
      return JSON.parse(cachedPairs) as PairDataMap;
    }

    return null;
  }

  async getCachedPrices(): Promise<PriceDataMap | null> {
    const cachedPrices = await this.dexHelper.cache.get(
      this.dexKey,
      this.network,
      this.pricesCacheKey,
    );

    if (cachedPrices) {
      return JSON.parse(cachedPrices) as PriceDataMap;
    }

    return null;
  }

  async getCachedTokensAddr(): Promise<TokenAddrDataMap | null> {
    const cachedTokensAddr = await this.dexHelper.cache.get(
      this.dexKey,
      this.network,
      this.tokensAddrCacheKey,
    );

    if (cachedTokensAddr) {
      return JSON.parse(cachedTokensAddr) as TokenAddrDataMap;
    }

    return null;
  }

  async getCachedTokens(): Promise<TokenDataMap | null> {
    const cachedTokens = await this.dexHelper.cache.get(
      this.dexKey,
      this.network,
      this.tokensCacheKey,
    );

    if (cachedTokens) {
      return JSON.parse(cachedTokens) as TokenDataMap;
    }

    return null;
  }

  normalizeAddress(address: string): string {
    return address.toLowerCase() === ETHER_ADDRESS
      ? ethers.constants.AddressZero.toLowerCase()
      : address.toLowerCase();
  }

  // Dexalot protocol for native token expects 0x00000... instead of 0xeeeee...
  normalizeToken(token: Token): Token {
    return {
      address: this.normalizeAddress(token.address),
      decimals: token.decimals,
    };
  }

  calculateOrderPrice(
    amounts: bigint[],
    orderbook: string[][],
    baseToken: Token,
    quoteToken: Token,
    side: ClobSide,
  ) {
    let result = [];

    for (let i = 0; i < amounts.length; i++) {
      let amt = amounts[i];
      if (amt === 0n) {
        result.push(amt);
        continue;
      }

      let totalVolume = 0n;
      let combinedPrice = 0n;

      for (let j = 0; j < orderbook.length; j++) {
        const order = orderbook[j];
        const priceBN = ethers.utils.parseUnits(order[0], quoteToken.decimals);
        const price = BigInt(priceBN.toString());
        const qtyBN = ethers.utils.parseUnits(order[1], baseToken.decimals);
        const qty = BigInt(qtyBN.toString());
        let vol = qty;
        if (side === ClobSide.BID) {
          vol = (qty * price) / BigInt(10 ** baseToken.decimals);
        }
        if (amt < vol) {
          totalVolume += amt;
          combinedPrice += amt * price;
          amt = 0n;
        } else {
          amt -= vol;
          totalVolume += vol;
          combinedPrice += vol * price;
        }
        if (amt === 0n) {
          break;
        }
      }
      if (amt > 0n) {
        return result;
      }
      const avgPrice = combinedPrice / totalVolume;
      if (side === ClobSide.BID) {
        result.push((amounts[i] * BigInt(10 ** baseToken.decimals)) / avgPrice);
      } else {
        result.push((avgPrice * amounts[i]) / BigInt(10 ** baseToken.decimals));
      }
    }
    return result;
  }

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<DexalotData>> {
    try {
      const normalizedSrcToken = this.normalizeToken(srcToken);
      const normalizedDestToken = this.normalizeToken(destToken);

      if (normalizedSrcToken.address === normalizedDestToken.address) {
        return null;
      }

      if (limitPools && limitPools.length !== 1) {
        return null;
      }

      const pairData = await this.getPairData(
        normalizedSrcToken,
        normalizedDestToken,
      );
      if (!pairData) {
        return null;
      }

      const priceMap = await this.getCachedPrices();
      if (!priceMap) {
        return null;
      }

      const pairKey = `${pairData.base}/${pairData.quote}`.toLowerCase();
      if (!(pairKey in priceMap)) {
        return null;
      }

      const priceData = priceMap[pairKey];
      const baseToken = pairData.isSrcBase
        ? normalizedSrcToken
        : normalizedDestToken;
      const quoteToken = pairData.isSrcBase
        ? normalizedDestToken
        : normalizedSrcToken;

      // convert from swap to clob side
      let orderbook = priceData.asks;
      let clobSide = ClobSide.BID;
      if (
        (side === SwapSide.SELL && pairData.isSrcBase) ||
        (side === SwapSide.BUY && !pairData.isSrcBase)
      ) {
        orderbook = priceData.bids;
        clobSide = ClobSide.ASK;
      }
      if (orderbook.length === 0) {
        throw new Error(`Empty orderbook for ${pairKey}`);
      }

      const prices = this.calculateOrderPrice(
        amounts,
        orderbook,
        baseToken,
        quoteToken,
        clobSide,
      );
      const outDecimals =
        clobSide === ClobSide.BID ? baseToken.decimals : quoteToken.decimals;
      const poolIdentifier = this.getIdentifier(pairData.base, pairData.quote);

      return [
        {
          prices,
          unit: BigInt(outDecimals),
          data: {},
          poolIdentifier: poolIdentifier,
          exchange: this.dexKey,
          gasCost: DEXALOT_GAS_COST,
          poolAddresses: [this.mainnetRFQAddress],
        },
      ];
    } catch (e: unknown) {
      this.logger.error(
        `Error_getPricesVolume ${srcToken.symbol || srcToken.address}, ${
          destToken.symbol || destToken.address
        }, ${side}:`,
        e,
      );
      return null;
    }
  }

  generateRFQError(errorStr: string, swapIdentifier: string) {
    const message = `${this.dexKey}-${this.network}: Failed to fetch RFQ for ${swapIdentifier}. ${errorStr}`;
    this.logger.warn(message);
    throw new RfqError(message);
  }

  async preProcessTransaction(
    optimalSwapExchange: OptimalSwapExchange<DexalotData>,
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    options: PreprocessTransactionOptions,
  ): Promise<[OptimalSwapExchange<DexalotData>, ExchangeTxInfo]> {
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
    if (await this.isRateLimited(options.txOrigin)) {
      this.logger.warn(
        `${this.dexKey}-${this.network}: rate limited TX Origin address '${options.txOrigin}' trying to build a transaction. Bailing...`,
      );
      throw new Error(
        `${this.dexKey}-${
          this.network
        }: user=${options.txOrigin.toLowerCase()} is rate limited`,
      );
    }
    if (BigInt(optimalSwapExchange.srcAmount) === 0n) {
      throw new Error('getFirmRate failed with srcAmount == 0');
    }

    const normalizedSrcToken = this.normalizeToken(srcToken);
    const normalizedDestToken = this.normalizeToken(destToken);
    const swapIdentifier = `${this.getIdentifier(
      normalizedSrcToken.address,
      normalizedDestToken.address,
    )}_${side}`;

    try {
      const makerToken = normalizedDestToken;
      const takerToken = normalizedSrcToken;

      const rfqParams = {
        makerAsset: ethers.utils.getAddress(makerToken.address),
        takerAsset: ethers.utils.getAddress(takerToken.address),
        makerAmount:
          side === SwapSide.BUY ? optimalSwapExchange.destAmount : undefined,
        takerAmount:
          side === SwapSide.SELL ? optimalSwapExchange.srcAmount : undefined,
        userAddress: options.txOrigin,
        chainid: this.network,
      };

      const rfq: RFQResponse = await this.dexHelper.httpRequest.post(
        `${DEXALOT_API_URL}/api/rfq/firm`,
        rfqParams,
        undefined,
        { 'x-apikey': this.dexalotAuthToken },
      );
      if (!rfq) {
        this.generateRFQError(
          'Missing quote data',
          `RFQ ${swapIdentifier} ${JSON.stringify(rfq)}`,
        );
      } else if (!rfq.signature) {
        this.generateRFQError('Missing signature', swapIdentifier);
      }
      rfq.order.signature = rfq.signature;

      const { order } = rfq;

      assert(
        order.makerAsset.toLowerCase() === makerToken.address,
        `QuoteData makerAsset=${order.makerAsset} is different from Paraswap makerAsset=${makerToken.address}`,
      );
      assert(
        order.takerAsset.toLowerCase() === takerToken.address,
        `QuoteData takerAsset=${order.takerAsset} is different from Paraswap takerAsset=${takerToken.address}`,
      );
      if (side === SwapSide.SELL) {
        assert(
          order.takerAmount === optimalSwapExchange.srcAmount,
          `QuoteData takerAmount=${order.takerAmount} is different from Paraswap srcAmount=${optimalSwapExchange.srcAmount}`,
        );
      } else {
        assert(
          order.makerAmount === optimalSwapExchange.destAmount,
          `QuoteData makerAmount=${order.makerAmount} is different from Paraswap destAmount=${optimalSwapExchange.destAmount}`,
        );
      }

      const expiryAsBigInt = BigInt(order.expiry);
      const minDeadline = expiryAsBigInt > 0 ? expiryAsBigInt : BI_MAX_UINT256;

      const slippageFactor = options.slippageFactor;
      if (side === SwapSide.SELL) {
        if (
          BigInt(order.makerAmount) <
          BigInt(
            new BigNumber(optimalSwapExchange.destAmount)
              .times(slippageFactor)
              .toFixed(0),
          )
        ) {
          const message = `${this.dexKey}-${this.network}: too much slippage on quote ${side} quoteTokenAmount ${order.makerAmount} / destAmount ${optimalSwapExchange.destAmount} < ${slippageFactor}`;
          throw new SlippageCheckError(message);
        }
      } else {
        if (
          BigInt(order.takerAmount) >
          BigInt(
            new BigNumber(optimalSwapExchange.srcAmount)
              .times(slippageFactor)
              .toFixed(0),
          )
        ) {
          const message = `${this.dexKey}-${
            this.network
          }: too much slippage on quote ${side} baseTokenAmount ${
            order.takerAmount
          } / srcAmount ${
            optimalSwapExchange.srcAmount
          } > ${slippageFactor.toFixed()}`;
          throw new SlippageCheckError(message);
        }
      }

      return [
        {
          ...optimalSwapExchange,
          data: {
            quoteData: order,
          },
        },
        { deadline: minDeadline },
      ];
    } catch (e) {
      if (isAxiosError(e) && e.response && e.response.data) {
        const errorData: RFQResponseError = e.response.data;
        if (errorData.ReasonCode === 'FQ-009') {
          this.logger.warn(
            `${this.dexKey}-${this.network}: Encountered rate limited user=${options.txOrigin}. Adding to local rate limit cache`,
          );
          await this.setRateLimited(options.txOrigin, errorData.RetryAfter);
        } else {
          this.logger.error(
            `${this.dexKey}-${this.network}: Failed to fetch RFQ for ${swapIdentifier}: ${errorData.Reason}`,
          );
        }
      } else if (e instanceof SlippageCheckError) {
        this.logger.warn(e.message);
      } else {
        this.logger.error(
          `${this.dexKey}-${this.network}: Failed to fetch RFQ for ${swapIdentifier}:`,
          JSON.stringify(e),
        );
      }

      throw e;
    }
  }

  getCalldataGasCost(poolPrices: PoolPrices<DexalotData>): number | number[] {
    return (
      CALLDATA_GAS_COST.DEX_OVERHEAD +
      // addresses: makerAsset, takerAsset, maker, taker
      CALLDATA_GAS_COST.ADDRESS * 4 +
      // uint256: expiry
      CALLDATA_GAS_COST.wordNonZeroBytes(16) +
      // uint256: nonceAndMeta, makerAmount, takerAmount
      CALLDATA_GAS_COST.AMOUNT * 3 +
      // bytes: _signature (65 bytes)
      CALLDATA_GAS_COST.FULL_WORD * 2 +
      CALLDATA_GAS_COST.OFFSET_SMALL
    );
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
    data: DexalotData,
    side: SwapSide,
  ): AdapterExchangeParam {
    const { quoteData } = data;

    assert(
      quoteData !== undefined,
      `${this.dexKey}-${this.network}: quoteData undefined`,
    );

    const swapFunction = 'simpleSwap';
    const swapFunctionParams = [
      [
        quoteData.nonceAndMeta,
        quoteData.expiry,
        quoteData.makerAsset,
        quoteData.takerAsset,
        quoteData.maker,
        quoteData.taker,
        quoteData.makerAmount,
        quoteData.takerAmount,
      ],
      quoteData.signature,
    ];

    const payload = this.rfqInterface.encodeFunctionData(
      swapFunction,
      swapFunctionParams,
    );

    return {
      targetExchange: this.mainnetRFQAddress,
      payload,
      networkFee: '0',
    };
  }

  async setBlacklist(txOrigin: Address): Promise<boolean> {
    await this.dexHelper.cache.sadd(
      this.blacklistCacheKey,
      txOrigin.toLowerCase(),
    );
    return true;
  }

  async isBlacklisted(txOrigin: Address): Promise<boolean> {
    return this.dexHelper.cache.sismember(
      this.blacklistCacheKey,
      txOrigin.toLowerCase(),
    );
  }

  getRateLimitedKey(address: Address) {
    return `rate_limited_${address}`.toLowerCase();
  }

  async isRateLimited(txOrigin: Address): Promise<boolean> {
    const result = await this.dexHelper.cache.get(
      this.dexKey,
      this.network,
      this.getRateLimitedKey(txOrigin),
    );
    return result === 'limited';
  }

  async setRateLimited(txOrigin: Address, ttl?: number) {
    await this.dexHelper.cache.setex(
      this.dexKey,
      this.network,
      this.getRateLimitedKey(txOrigin),
      ttl || DEXALOT_RATE_LIMITED_TTL_S,
      'limited',
    );
    return true;
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: DexalotData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const { quoteData } = data;

    assert(
      quoteData !== undefined,
      `${this.dexKey}-${this.network}: quoteData undefined`,
    );

    const swapFunction = 'simpleSwap';
    const swapFunctionParams = [
      [
        quoteData.nonceAndMeta,
        quoteData.expiry,
        quoteData.makerAsset,
        quoteData.takerAsset,
        quoteData.maker,
        quoteData.taker,
        quoteData.makerAmount,
        quoteData.takerAmount,
      ],
      quoteData.signature,
    ];

    const swapData = this.rfqInterface.encodeFunctionData(
      swapFunction,
      swapFunctionParams,
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      this.mainnetRFQAddress,
    );
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    const normalizedAddress = this.normalizeAddress(tokenAddress);

    const pairs = (await this.getCachedPairs()) || {};
    const tokens = (await this.getCachedTokens()) || {};
    const tokensAddr = (await this.getCachedTokensAddr()) || {};
    if (!tokens[normalizedAddress]) {
      return [];
    }

    const token = tokens[normalizedAddress];
    const tokenSymbol = token.symbol?.toLowerCase() || '';

    let pairsByLiquidity = [];
    for (const pairName of Object.keys(pairs)) {
      if (pairName.includes(tokenSymbol)) {
        const tokensInPair = pairName.split('/');
        if (tokensInPair.length !== 2) {
          continue;
        }

        const addr = tokensAddr[tokensInPair[0].toLowerCase()];
        let outputToken = tokens[addr];
        if (tokensInPair[0] === tokenSymbol) {
          const addr = tokensAddr[tokensInPair[1].toLowerCase()];
          outputToken = tokens[addr];
        }

        const connectorToken = {
          address: outputToken.address,
          decimals: outputToken.decimals,
        };
        const pairData: PoolLiquidity = {
          exchange: this.dexKey,
          address: this.mainnetRFQAddress,
          connectorTokens: [connectorToken],
          liquidityUSD: pairs[pairName].liquidityUSD,
        };
        pairsByLiquidity.push(pairData);
      }
    }

    pairsByLiquidity.sort(
      (a: PoolLiquidity, b: PoolLiquidity) => b.liquidityUSD - a.liquidityUSD,
    );

    return pairsByLiquidity.slice(0, limit);
  }

  releaseResources(): void {
    if (this.rateFetcher) {
      this.rateFetcher.stop();
    }
  }
}
