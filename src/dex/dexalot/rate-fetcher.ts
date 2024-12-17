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

export class RateFetcher {
  private pairsFetcher: Fetcher<DexalotPairsResponse>;
  private pairsCacheKey: string;

  private rateFetcher: Fetcher<DexalotPricesResponse>;
  private pricesCacheKey: string;
  private pricesCacheTTL: number;

  private tokensAddrCacheKey: string;
  private tokensCacheKey: string;
  private tokensCacheTTL: number;

  private blacklistFetcher: Fetcher<DexalotBlacklistResponse>;
  private blacklistCacheKey: string;
  private blacklistCacheTTL: number;

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
  }

  start() {
    this.pairsFetcher.startPolling();
    this.rateFetcher.startPolling();
    this.blacklistFetcher.startPolling();
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
  }

  private async handleBlacklistResponse(
    resp: DexalotBlacklistResponse,
  ): Promise<void> {
    const { blacklist } = resp;
    this.dexHelper.cache.setex(
      this.dexKey,
      this.network,
      this.blacklistCacheKey,
      this.blacklistCacheTTL,
      JSON.stringify(blacklist.map(item => item.toLowerCase())),
    );
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

    return true;
  }

  async isBlacklisted(txOrigin: Address): Promise<boolean> {
    const cachedBlacklist = await this.dexHelper.cache.get(
      this.dexKey,
      this.network,
      this.blacklistCacheKey,
    );

    if (cachedBlacklist) {
      const blacklist = JSON.parse(cachedBlacklist) as string[];
      return blacklist.includes(txOrigin.toLowerCase());
    }

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
    return true;
  }

  async isRestrictedPool(poolIdentifier: string): Promise<boolean> {
    const result = await this.dexHelper.cache.get(
      this.dexKey,
      this.network,
      this.getRestrictedPoolKey(poolIdentifier),
    );

    return result === 'true';
  }

  getRestrictedPoolKey(poolIdentifier: string): string {
    return `${DEXALOT_RESTRICTED_CACHE_KEY}-${poolIdentifier}`;
  }
}
