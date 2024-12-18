import {
  MarketMakersResponse,
  PriceLevelsResponse,
} from '@hashflow/taker-js/dist/types/rest';
import { Network } from '../../constants';
import { IDexHelper } from '../../dex-helper';
import { Fetcher, SkippingRequest } from '../../lib/fetcher/fetcher';
import { validateAndCast } from '../../lib/validators';
import { Address, Logger } from '../../types';
import {
  HashflowMarketMakersResponse,
  HashflowRateFetcherConfig,
  HashflowRatesResponse,
} from './types';
import { marketMakersValidator, pricesResponseValidator } from './validators';
import { HASHFLOW_BLACKLIST_TTL_S } from './constants';
import { JsonPubSub, SetPubSub } from '../../lib/pub-sub';

export class RateFetcher {
  private rateFetcher: Fetcher<HashflowRatesResponse>;
  private ratePubSub: JsonPubSub;
  private pricesCacheKey: string;
  private pricesCacheTTL: number;

  private marketMakersFetcher: Fetcher<HashflowMarketMakersResponse>;
  private marketMakersCacheKey: string;
  private marketMakersCacheTTL: number;

  private blacklistedPubSub: SetPubSub;

  constructor(
    private dexHelper: IDexHelper,
    private dexKey: string,
    private network: Network,
    private logger: Logger,
    config: HashflowRateFetcherConfig,
  ) {
    this.pricesCacheKey = config.rateConfig.pricesCacheKey;
    this.pricesCacheTTL = config.rateConfig.pricesCacheTTLSecs;
    this.marketMakersCacheKey = config.rateConfig.marketMakersCacheKey;
    this.marketMakersCacheTTL = config.rateConfig.marketMakersCacheTTLSecs;
    this.marketMakersFetcher = new Fetcher<HashflowMarketMakersResponse>(
      dexHelper.httpRequest,
      {
        info: {
          requestOptions: config.rateConfig.marketMakersReqParams,
          caster: (data: unknown) => {
            return validateAndCast<HashflowMarketMakersResponse>(
              data,
              marketMakersValidator,
            );
          },
        },
        handler: this.handleMarketMakersResponse.bind(this),
      },
      config.rateConfig.markerMakersIntervalMs,
      logger,
    );

    this.ratePubSub = new JsonPubSub(dexHelper, dexKey, 'rates');

    this.rateFetcher = new Fetcher<HashflowRatesResponse>(
      dexHelper.httpRequest,
      {
        info: {
          requestOptions: config.rateConfig.pricesReqParams,
          requestFunc: async options => {
            const { filterMarketMakers } = config.rateConfig;

            const cachedMarketMakers =
              (await this.getCachedMarketMakers()) || [];
            const filteredMarketMakers = await filterMarketMakers(
              cachedMarketMakers,
            );

            if (filteredMarketMakers.length === 0) {
              return new SkippingRequest(
                `${dexKey}-${network}: got ${filteredMarketMakers.length} market makers.`,
              );
            }

            options.params.marketMakers = filteredMarketMakers;

            const prices = await dexHelper.httpRequest.request(options);

            return prices;
          },
          caster: (data: unknown) => {
            return validateAndCast<HashflowRatesResponse>(
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

    this.blacklistedPubSub = new SetPubSub(
      dexHelper,
      dexKey,
      'blacklisted',
      // TODO-rfq-ps: temporary for validation local with cache
      '',
    );
  }

  async start() {
    if (!this.dexHelper.config.isSlave) {
      this.marketMakersFetcher.startPolling();
      this.rateFetcher.startPolling();
    } else {
      this.ratePubSub.subscribe();

      const allBlacklisted = await this.getAllBlacklisted();
      this.blacklistedPubSub.initializeAndSubscribe(allBlacklisted);
    }
  }

  stop() {
    this.marketMakersFetcher.stopPolling();
    this.rateFetcher.stopPolling();
  }

  private handleMarketMakersResponse(resp: HashflowMarketMakersResponse): void {
    const { marketMakers } = resp;
    this.dexHelper.cache.rawset(
      this.marketMakersCacheKey,
      JSON.stringify(marketMakers),
      this.marketMakersCacheTTL,
    );
  }

  private handleRatesResponse(resp: HashflowRatesResponse): void {
    const { levels } = resp;
    this.dexHelper.cache.setex(
      this.dexKey,
      this.network,
      this.pricesCacheKey,
      this.pricesCacheTTL,
      JSON.stringify(levels),
    );

    this.ratePubSub.publish(
      { [this.pricesCacheKey]: levels },
      this.pricesCacheTTL,
    );
  }

  async getCachedMarketMakers(): Promise<
    MarketMakersResponse['marketMakers'] | null
  > {
    const cachedMarketMakers = await this.dexHelper.cache.rawget(
      this.marketMakersCacheKey,
    );

    if (cachedMarketMakers) {
      return JSON.parse(
        cachedMarketMakers,
      ) as MarketMakersResponse['marketMakers'];
    }

    return null;
  }

  async getCachedLevels(): Promise<PriceLevelsResponse['levels'] | null> {
    const cachedLevels = await this.ratePubSub.getAndCache(this.pricesCacheKey);

    if (cachedLevels) {
      return cachedLevels as PriceLevelsResponse['levels'];
    }

    return null;
  }

  async isBlacklisted(txOrigin: Address): Promise<boolean> {
    return this.blacklistedPubSub.has(txOrigin.toLowerCase());
  }

  async setBlacklist(
    txOrigin: Address,
    ttl: number = HASHFLOW_BLACKLIST_TTL_S,
  ) {
    await this.dexHelper.cache.setex(
      this.dexKey,
      this.network,
      this.getBlackListKey(txOrigin),
      ttl,
      'blacklisted',
    );

    this.blacklistedPubSub.publish([txOrigin.toLowerCase()]);

    return true;
  }

  async getAllBlacklisted(): Promise<Address[]> {
    const defaultKey = this.getBlackListKey('');
    const pattern = `${defaultKey}*`;
    const allBlacklisted = await this.dexHelper.cache.keys(
      this.dexKey,
      this.network,
      pattern,
    );

    return allBlacklisted.map(t => this.getAddressFromBlackListKey(t));
  }

  getBlackListKey(address: Address) {
    return `blacklist_${address}`.toLowerCase();
  }

  getAddressFromBlackListKey(key: Address) {
    return (key.split('blacklist_')[1] ?? '').toLowerCase();
  }
}
