import { Network } from '../../constants';
import { IDexHelper } from '../../dex-helper';
import { Fetcher } from '../../lib/fetcher/fetcher';
import { JsonPubSub, SetPubSub } from '../../lib/pub-sub';
import { validateAndCast } from '../../lib/validators';
import { Address, Logger, Token } from '../../types';
import { PairData } from '../cables/types';
import {
  CABLES_RESTRICT_TTL_S,
  CABLES_RESTRICTED_CACHE_KEY,
} from './constants';
import {
  CablesBlacklistResponse,
  CablesPairsResponse,
  CablesPricesResponse,
  CablesRateFetcherConfig,
  CablesTokensResponse,
} from './types';
import {
  blacklistResponseValidator,
  pairsResponseValidator,
  pricesResponseValidator,
  tokensResponseValidator,
} from './validators';

export class CablesRateFetcher {
  private tokensPairsPricesPubSub: JsonPubSub;

  public tokensFetcher: Fetcher<CablesTokensResponse>;
  public tokensCacheKey: string;
  public tokensCacheTTL: number;

  public pairsFetcher: Fetcher<CablesPairsResponse>;
  public pairsCacheKey: string;
  public pairsCacheTTL: number;

  public pricesFetcher: Fetcher<CablesPricesResponse>;
  public pricesCacheKey: string;
  public pricesCacheTTL: number;

  public blacklistFetcher: Fetcher<CablesBlacklistResponse>;
  private blacklistPubSub: SetPubSub;
  public blacklistCacheKey: string;
  public blacklistCacheTTL: number;

  private restrictPubSub: JsonPubSub;

  constructor(
    private dexHelper: IDexHelper,
    private dexKey: string,
    private network: Network,
    private logger: Logger,
    config: CablesRateFetcherConfig,
  ) {
    this.tokensCacheKey = config.rateConfig.tokensCacheKey;
    this.tokensCacheTTL = config.rateConfig.tokensCacheTTLSecs;

    this.pairsCacheKey = config.rateConfig.pairsCacheKey;
    this.pairsCacheTTL = config.rateConfig.pairsCacheTTLSecs;

    this.pricesCacheKey = config.rateConfig.pricesCacheKey;
    this.pricesCacheTTL = config.rateConfig.pricesCacheTTLSecs;

    this.blacklistCacheKey = config.rateConfig.blacklistCacheKey;
    this.blacklistCacheTTL = config.rateConfig.blacklistCacheTTLSecs;

    this.tokensPairsPricesPubSub = new JsonPubSub(
      dexHelper,
      dexKey,
      'tokensPairsPrices',
    );

    this.pairsFetcher = new Fetcher<CablesPairsResponse>(
      dexHelper.httpRequest,
      {
        info: {
          requestOptions: config.rateConfig.pairsReqParams,
          caster: (data: unknown) => {
            return validateAndCast<CablesPairsResponse>(
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

    this.pricesFetcher = new Fetcher<CablesPricesResponse>(
      dexHelper.httpRequest,
      {
        info: {
          requestOptions: config.rateConfig.pricesReqParams,
          caster: (data: unknown) => {
            return validateAndCast<CablesPricesResponse>(
              data,
              pricesResponseValidator,
            );
          },
        },
        handler: this.handlePricesResponse.bind(this),
      },
      config.rateConfig.pricesIntervalMs,
      logger,
    );

    this.blacklistPubSub = new SetPubSub(dexHelper, dexKey, 'blacklist', '');
    this.blacklistFetcher = new Fetcher<CablesBlacklistResponse>(
      dexHelper.httpRequest,
      {
        info: {
          requestOptions: config.rateConfig.blacklistReqParams,
          caster: (data: unknown) => {
            return validateAndCast<CablesBlacklistResponse>(
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

    this.tokensFetcher = new Fetcher<CablesTokensResponse>(
      dexHelper.httpRequest,
      {
        info: {
          requestOptions: config.rateConfig.tokensReqParams,
          caster: (data: unknown) => {
            return validateAndCast<CablesTokensResponse>(
              data,
              tokensResponseValidator,
            );
          },
        },
        handler: this.handleTokensResponse.bind(this),
      },
      config.rateConfig.tokensIntervalMs,
      logger,
    );

    this.restrictPubSub = new JsonPubSub(
      dexHelper,
      dexKey,
      'restrict',
      'not_restricted',
      CABLES_RESTRICT_TTL_S,
    );
  }

  /**
   * Utils
   */
  async start() {
    if (!this.dexHelper.config.isSlave) {
      this.pairsFetcher.startPolling();
      this.pricesFetcher.startPolling();
      this.blacklistFetcher.startPolling();
      this.tokensFetcher.startPolling();
    } else {
      this.tokensPairsPricesPubSub.subscribe();
      this.restrictPubSub.subscribe();

      const initBlacklisted = await this.getAllBlacklisted();
      this.blacklistPubSub.initializeAndSubscribe(initBlacklisted);
    }
  }
  stop() {
    this.pairsFetcher.stopPolling();
    this.pricesFetcher.stopPolling();
    this.blacklistFetcher.stopPolling();
    this.tokensFetcher.stopPolling();
  }

  private handlePairsResponse(res: CablesPairsResponse): void {
    const networkId = String(this.network);
    const pairs = res.pairs[networkId];

    let normalized_pairs: { [token: string]: PairData } = {};
    Object.keys(pairs).forEach(key => {
      normalized_pairs[key.toLowerCase()] = pairs[key];
    });

    this.dexHelper.cache.setex(
      this.dexKey,
      this.network,
      this.pairsCacheKey,
      this.pairsCacheTTL,
      JSON.stringify(normalized_pairs),
    );

    this.tokensPairsPricesPubSub.publish(
      { [this.pairsCacheKey]: normalized_pairs },
      this.pairsCacheTTL,
    );
  }

  private handlePricesResponse(res: CablesPricesResponse): void {
    const networkId = String(this.network);
    const prices = res.prices[networkId];

    this.dexHelper.cache.setex(
      this.dexKey,
      this.network,
      this.pricesCacheKey,
      this.pricesCacheTTL,
      JSON.stringify(prices),
    );

    this.tokensPairsPricesPubSub.publish(
      { [this.pricesCacheKey]: prices },
      this.pricesCacheTTL,
    );
  }

  private handleBlacklistResponse(res: CablesBlacklistResponse): void {
    const { blacklist } = res;
    const list = blacklist.map(item => item.toLowerCase());
    this.dexHelper.cache.setex(
      this.dexKey,
      this.network,
      this.blacklistCacheKey,
      this.blacklistCacheTTL,
      JSON.stringify(list),
    );

    this.blacklistPubSub.publish(list);
  }

  // Convert addresses to lowercase
  private normalizeAddressesToLowerCase = (
    jsonData: Record<string, { address: string }>,
  ) => {
    Object.keys(jsonData).forEach(key => {
      jsonData[key].address = jsonData[key].address.toLowerCase();
    });
    return jsonData;
  };

  private async handleTokensResponse(res: CablesTokensResponse): Promise<void> {
    const networkId = String(this.network);
    const tokens = res.tokens[networkId];

    const normalizedTokens = this.normalizeAddressesToLowerCase(tokens);

    this.dexHelper.cache.setex(
      this.dexKey,
      this.network,
      this.tokensCacheKey,
      this.tokensCacheTTL,
      JSON.stringify(normalizedTokens),
    );

    this.tokensPairsPricesPubSub.publish(
      { [this.tokensCacheKey]: normalizedTokens },
      this.tokensCacheTTL,
    );
  }

  /**
   * CACHED UTILS
   */
  async getCachedTokens(): Promise<any> {
    const cachedTokens = await this.tokensPairsPricesPubSub.getAndCache(
      this.tokensCacheKey,
    );
    return cachedTokens ?? {};
  }

  async getCachedPairs(): Promise<any> {
    const cachedPairs = await this.tokensPairsPricesPubSub.getAndCache(
      this.pairsCacheKey,
    );
    return cachedPairs ?? {};
  }

  async getCachedPrices(): Promise<any> {
    const cachedPrices = await this.tokensPairsPricesPubSub.getAndCache(
      this.pricesCacheKey,
    );

    return cachedPrices ?? {};
  }

  async getAllBlacklisted(): Promise<string[]> {
    const cachedBlacklist = await this.dexHelper.cache.get(
      this.dexKey,
      this.network,
      this.blacklistCacheKey,
    );

    return cachedBlacklist ? JSON.parse(cachedBlacklist) : [];
  }

  async isBlacklisted(txOrigin: Address): Promise<boolean> {
    return this.blacklistPubSub.has(txOrigin.toLowerCase());
  }

  async isRestricted(): Promise<boolean> {
    const result = await this.restrictPubSub.getAndCache(
      CABLES_RESTRICTED_CACHE_KEY,
    );

    return result === 'true';
  }

  async restrict(): Promise<void> {
    await this.dexHelper.cache.setex(
      this.dexKey,
      this.network,
      CABLES_RESTRICTED_CACHE_KEY,
      CABLES_RESTRICT_TTL_S,
      'true',
    );

    this.restrictPubSub.publish(
      { [CABLES_RESTRICTED_CACHE_KEY]: 'true' },
      CABLES_RESTRICT_TTL_S,
    );
  }
}
