import { Network } from '../../constants';
import { IDexHelper } from '../../dex-helper';
import { Fetcher } from '../../lib/fetcher/fetcher';
import { validateAndCast } from '../../lib/validators';
import { Address, Logger, Token } from '../../types';
import {
  DexalotBlacklistResponse,
  TokenDataMap,
  TokenAddrDataMap,
  DexalotPairsResponse,
  DexalotPricesResponse,
  DexalotRateFetcherConfig,
  PairDataMap,
  PriceDataMap,
} from './types';
import {
  blacklistResponseValidator,
  pairsResponseValidator,
  pricesResponseValidator,
} from './validators';
import {
  DEXALOT_BLACKLIST_CACHES_TTL_S,
  DEXALOT_RATE_LIMITED_TTL_S,
  DEXALOT_RATELIMIT_CACHE_VALUE,
  DEXALOT_RESTRICT_TTL_S,
  DEXALOT_RESTRICTED_CACHE_KEY,
} from './constants';
import { ExpKeyValuePubSub, NonExpSetPubSub } from '../../lib/pub-sub';

export class RateFetcher {
  private pairsFetcher: Fetcher<DexalotPairsResponse>;
  private pairsCacheKey: string;

  private rateFetcher: Fetcher<DexalotPricesResponse>;
  private rateTokensPubSub: ExpKeyValuePubSub;
  private pricesCacheKey: string;
  private pricesCacheTTL: number;

  private tokensAddrCacheKey: string;
  private tokensCacheKey: string;
  private tokensCacheTTL: number;

  private blacklistFetcher: Fetcher<DexalotBlacklistResponse>;
  private blacklistPubSub: NonExpSetPubSub;
  private blacklistCacheKey: string;
  private blacklistCacheTTL: number;

  private restrictedPoolPubSub: ExpKeyValuePubSub;

  constructor(
    private dexHelper: IDexHelper,
    private dexKey: string,
    private network: Network,
    private logger: Logger,
    config: DexalotRateFetcherConfig,
  ) {
    this.pairsCacheKey = config.rateConfig.pairsCacheKey;
    this.pricesCacheKey = config.rateConfig.pricesCacheKey;
    this.pricesCacheTTL = config.rateConfig.pricesCacheTTLSecs;
    this.tokensAddrCacheKey = config.rateConfig.tokensAddrCacheKey;
    this.tokensCacheKey = config.rateConfig.tokensCacheKey;
    this.tokensCacheTTL = config.rateConfig.tokensCacheTTLSecs;
    this.blacklistCacheKey = config.rateConfig.blacklistCacheKey;
    this.blacklistCacheTTL = config.rateConfig.blacklistCacheTTLSecs;

    this.rateTokensPubSub = new ExpKeyValuePubSub(
      dexHelper,
      dexKey,
      'rateTokens',
    );

    this.pairsFetcher = new Fetcher<DexalotPairsResponse>(
      dexHelper.httpRequest,
      {
        info: {
          requestOptions: config.rateConfig.pairsReqParams,
          caster: (data: unknown) => {
            return validateAndCast<DexalotPairsResponse>(
              data,
              pairsResponseValidator,
            );
          },
        },
        handler: this.handlePairsResponse.bind(this),
      },
      config.rateConfig.pairsIntervalMs,
      logger,
    );

    this.rateFetcher = new Fetcher<DexalotPricesResponse>(
      dexHelper.httpRequest,
      {
        info: {
          requestOptions: config.rateConfig.pricesReqParams,
          caster: (data: unknown) => {
            return validateAndCast<DexalotPricesResponse>(
              data,
              pricesResponseValidator,
            );
          },
        },
        handler: this.handleRatesResponse.bind(this),
      },
      config.rateConfig.pricesIntervalMs,
      logger,
    );

    this.blacklistPubSub = new NonExpSetPubSub(dexHelper, dexKey, 'blacklist');
    this.blacklistFetcher = new Fetcher<DexalotBlacklistResponse>(
      dexHelper.httpRequest,
      {
        info: {
          requestOptions: config.rateConfig.blacklistReqParams,
          caster: (data: unknown) => {
            return validateAndCast<DexalotBlacklistResponse>(
              data,
              blacklistResponseValidator,
            );
          },
        },
        handler: this.handleBlacklistResponse.bind(this),
      },
      config.rateConfig.blacklistIntervalMs,
      logger,
    );

    this.restrictedPoolPubSub = new ExpKeyValuePubSub(
      dexHelper,
      dexKey,
      'restricted-pool',
      // using default value, we can lazy load non-restricted pools
      // and restrict them by subscribing to this channel
      'false',
      DEXALOT_RESTRICT_TTL_S,
    );
  }

  async start() {
    if (!this.dexHelper.config.isSlave) {
      this.pairsFetcher.startPolling();
      this.rateFetcher.startPolling();
      this.blacklistFetcher.startPolling();
    } else {
      this.rateTokensPubSub.subscribe();
      this.restrictedPoolPubSub.subscribe();

      const initSet = await this.getAllBlacklisted();
      this.blacklistPubSub.initializeAndSubscribe(initSet);
    }
  }

  stop() {
    this.pairsFetcher.stopPolling();
    this.rateFetcher.stopPolling();
    this.blacklistFetcher.stopPolling();
  }

  private handlePairsResponse(resp: DexalotPairsResponse): void {
    const pairs = resp;
    const dexPairs: PairDataMap = {};
    const tokenMap: { [address: string]: Token } = {};
    const tokenAddrMap: { [symbol: string]: string } = {};
    Object.keys(pairs).forEach(pair => {
      dexPairs[pair.toLowerCase()] = pairs[pair];
      tokenAddrMap[pairs[pair].base.toLowerCase()] =
        pairs[pair].baseAddress.toLowerCase();
      tokenAddrMap[pairs[pair].quote.toLowerCase()] =
        pairs[pair].quoteAddress.toLowerCase();
      tokenMap[pairs[pair].baseAddress.toLowerCase()] = {
        address: pairs[pair].baseAddress.toLowerCase(),
        symbol: pairs[pair].base,
        decimals: pairs[pair].baseDecimals,
      };
      tokenMap[pairs[pair].quoteAddress.toLowerCase()] = {
        address: pairs[pair].quoteAddress.toLowerCase(),
        symbol: pairs[pair].quote,
        decimals: pairs[pair].quoteDecimals,
      };
    });

    this.dexHelper.cache.setex(
      this.dexKey,
      this.network,
      this.pairsCacheKey,
      this.tokensCacheTTL,
      JSON.stringify(dexPairs),
    );

    this.dexHelper.cache.setex(
      this.dexKey,
      this.network,
      this.tokensCacheKey,
      this.tokensCacheTTL,
      JSON.stringify(tokenMap),
    );

    this.dexHelper.cache.setex(
      this.dexKey,
      this.network,
      this.tokensAddrCacheKey,
      this.tokensCacheTTL,
      JSON.stringify(tokenAddrMap),
    );

    this.rateTokensPubSub.publish(
      {
        [this.pairsCacheKey]: dexPairs,
        [this.tokensCacheKey]: tokenMap,
        [this.tokensAddrCacheKey]: tokenAddrMap,
      },
      this.tokensCacheTTL,
    );
  }

  private handleRatesResponse(resp: DexalotPricesResponse): void {
    const { prices } = resp;
    const dexPrices: PriceDataMap = {};
    Object.keys(prices).forEach(pair => {
      dexPrices[pair.toLowerCase()] = prices[pair];
    });

    this.dexHelper.cache.setex(
      this.dexKey,
      this.network,
      this.pricesCacheKey,
      this.pricesCacheTTL,
      JSON.stringify(dexPrices),
    );

    this.rateTokensPubSub.publish(
      { [this.pricesCacheKey]: dexPrices },
      this.pricesCacheTTL,
    );
  }

  private async handleBlacklistResponse(
    resp: DexalotBlacklistResponse,
  ): Promise<void> {
    const { blacklist } = resp;
    const data = blacklist.map(item => item.toLowerCase());
    this.dexHelper.cache.setex(
      this.dexKey,
      this.network,
      this.blacklistCacheKey,
      this.blacklistCacheTTL,
      JSON.stringify(data),
    );

    this.blacklistPubSub.publish(data);
  }

  async getCachedTokens(): Promise<TokenDataMap | null> {
    const cachedTokens = await this.rateTokensPubSub.getAndCache(
      this.tokensCacheKey,
    );

    if (cachedTokens) {
      return cachedTokens as TokenDataMap;
    }

    return null;
  }

  async getCachedPairs(): Promise<PairDataMap | null> {
    const cachedPairs = await this.rateTokensPubSub.getAndCache(
      this.pairsCacheKey,
    );

    if (cachedPairs) {
      return cachedPairs as PairDataMap;
    }

    return null;
  }

  async getCachedTokensAddr(): Promise<TokenAddrDataMap | null> {
    const cachedTokensAddr = await this.rateTokensPubSub.getAndCache(
      this.tokensAddrCacheKey,
    );

    if (cachedTokensAddr) {
      return cachedTokensAddr as TokenAddrDataMap;
    }

    return null;
  }

  async setBlacklist(
    txOrigin: Address,
    ttl: number = DEXALOT_BLACKLIST_CACHES_TTL_S,
  ): Promise<boolean> {
    const blacklist = await this.getAllBlacklisted();

    blacklist.push(txOrigin.toLowerCase());

    this.dexHelper.cache.setex(
      this.dexKey,
      this.network,
      this.blacklistCacheKey,
      ttl,
      JSON.stringify(blacklist),
    );

    this.blacklistPubSub.publish([txOrigin.toLowerCase()]);

    return true;
  }

  async getAllBlacklisted(): Promise<string[]> {
    const cachedBlacklist = await this.dexHelper.cache.get(
      this.dexKey,
      this.network,
      this.blacklistCacheKey,
    );

    if (cachedBlacklist) {
      return JSON.parse(cachedBlacklist);
    }

    return [];
  }

  async isBlacklisted(txOrigin: Address): Promise<boolean> {
    const blacklisted = await this.blacklistPubSub.has(txOrigin.toLowerCase());

    return blacklisted;

    /*
     rate-limit check was only if blacklist data set was not available,
     in the current implementation it should not be the case,
     so skip next check
    */
    // To not show pricing for rate limited users
    if (await this.isRateLimited(txOrigin)) {
      return true;
    }

    return false;
  }

  async setRateLimited(txOrigin: Address, ttl = DEXALOT_RATE_LIMITED_TTL_S) {
    await this.dexHelper.cache.setex(
      this.dexKey,
      this.network,
      this.getRateLimitedKey(txOrigin),
      ttl,
      DEXALOT_RATELIMIT_CACHE_VALUE,
    );
    return true;
  }

  async isRateLimited(txOrigin: Address): Promise<boolean> {
    const result = await this.dexHelper.cache.get(
      this.dexKey,
      this.network,
      this.getRateLimitedKey(txOrigin),
    );
    return result === DEXALOT_RATELIMIT_CACHE_VALUE;
  }

  getRateLimitedKey(address: Address) {
    return `rate_limited_${address}`.toLowerCase();
  }

  async getCachedPrices(): Promise<PriceDataMap | null> {
    const cachedPrices = await this.rateTokensPubSub.getAndCache(
      this.pricesCacheKey,
    );

    if (cachedPrices) {
      return cachedPrices as PriceDataMap;
    }

    return null;
  }

  async restrictPool(
    poolIdentifier: string,
    ttl: number = DEXALOT_RESTRICT_TTL_S,
  ): Promise<boolean> {
    await this.dexHelper.cache.setex(
      this.dexKey,
      this.network,
      this.getRestrictedPoolKey(poolIdentifier),
      ttl,
      'true',
    );

    await this.restrictedPoolPubSub.publish(
      { [this.getRestrictedPoolKey(poolIdentifier)]: 'true' },
      ttl,
    );
    return true;
  }

  async isRestrictedPool(poolIdentifier: string): Promise<boolean> {
    const result = await this.restrictedPoolPubSub.getAndCache(
      this.getRestrictedPoolKey(poolIdentifier),
    );

    return result === 'true';
  }

  getRestrictedPoolKey(poolIdentifier: string): string {
    return `${DEXALOT_RESTRICTED_CACHE_KEY}-${poolIdentifier}`;
  }
}
