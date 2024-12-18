import { IDexHelper } from '../../dex-helper';
import { Fetcher } from '../../lib/fetcher/fetcher';
import { validateAndCast } from '../../lib/validators';
import { Address, Logger, Token } from '../../types';
import {
  DexalotRateFetcherConfig,
  DexalotPairsResponse,
  PairDataMap,
  DexalotPricesResponse,
  PriceDataMap,
  DexalotBlacklistResponse,
  TokenDataMap,
  TokenAddrDataMap,
} from './types';
import {
  pricesResponseValidator,
  pairsResponseValidator,
  blacklistResponseValidator,
} from './validators';
import { Network } from '../../constants';
import {
  DEXALOT_BLACKLIST_CACHES_TTL_S,
  DEXALOT_RATE_LIMITED_TTL_S,
  DEXALOT_RATELIMIT_CACHE_VALUE,
  DEXALOT_RESTRICT_TTL_S,
  DEXALOT_RESTRICTED_CACHE_KEY,
} from './constants';
import { JsonPubSub, SetPubSub } from '../../lib/pub-sub';

export class RateFetcher {
  private pairsFetcher: Fetcher<DexalotPairsResponse>;
  private tokensPubSub: JsonPubSub;
  private pairsCacheKey: string;

  private rateFetcher: Fetcher<DexalotPricesResponse>;
  private ratePubSub: JsonPubSub;
  private pricesCacheKey: string;
  private pricesCacheTTL: number;

  private tokensAddrCacheKey: string;
  private tokensCacheKey: string;
  private tokensCacheTTL: number;

  private blacklistFetcher: Fetcher<DexalotBlacklistResponse>;
  private blacklistPubSub: SetPubSub;
  private blacklistCacheKey: string;
  private blacklistCacheTTL: number;

  private restrictedPoolPubSub: JsonPubSub;

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

    this.tokensPubSub = new JsonPubSub(dexHelper, dexKey, 'tokens');
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

    this.ratePubSub = new JsonPubSub(dexHelper, dexKey, 'prices');
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

    this.blacklistPubSub = new SetPubSub(
      dexHelper,
      dexKey,
      'blacklist',
      this.blacklistCacheKey,
    );

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

    this.restrictedPoolPubSub = new JsonPubSub(
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
      this.ratePubSub.subscribe();
      this.tokensPubSub.subscribe();
      this.restrictedPoolPubSub.subscribe();

      const initSet = await this.dexHelper.cache.smembers(
        this.blacklistCacheKey,
      );
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

    this.tokensPubSub.publish(
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

    this.ratePubSub.publish(dexPrices, this.pricesCacheTTL);
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
    const cachedTokens = await this.tokensPubSub.getAndCache(
      this.tokensCacheKey,
    );

    if (cachedTokens) {
      return cachedTokens as TokenDataMap;
    }

    return null;
  }

  async getCachedPairs(): Promise<PairDataMap | null> {
    const cachedPairs = await this.tokensPubSub.getAndCache(this.pairsCacheKey);

    if (cachedPairs) {
      return cachedPairs as PairDataMap;
    }

    return null;
  }

  async getCachedTokensAddr(): Promise<TokenAddrDataMap | null> {
    const cachedTokensAddr = await this.tokensPubSub.getAndCache(
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
    const cachedBlacklist = await this.dexHelper.cache.get(
      this.dexKey,
      this.network,
      this.blacklistCacheKey,
    );

    let blacklist: string[] = [];
    if (cachedBlacklist) {
      blacklist = JSON.parse(cachedBlacklist);
    }

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
    const cachedPrices = await this.ratePubSub.getAndCache(this.pricesCacheKey);

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
