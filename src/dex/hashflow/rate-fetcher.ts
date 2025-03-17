import { Network } from '../../constants';
import { IDexHelper } from '../../dex-helper';
import { Fetcher, SkippingRequest } from '../../lib/fetcher/fetcher';
import { validateAndCast } from '../../lib/validators';
import { Logger } from '../../types';
import {
  HashflowMarketMakersResponse,
  HashflowRateFetcherConfig,
  HashflowRatesResponse,
} from './types';
import { marketMakersValidator, pricesResponseValidator } from './validators';

export class RateFetcher {
  private rateFetcher: Fetcher<HashflowRatesResponse>;
  private pricesCacheKey: string;
  private pricesCacheTTL: number;

  private marketMakersFetcher: Fetcher<HashflowMarketMakersResponse>;
  private marketMakersCacheKey: string;
  private marketMakersCacheTTL: number;

  constructor(
    private dexHelper: IDexHelper,
    private dexKey: string,
    private network: Network,
    private logger: Logger,
    config: HashflowRateFetcherConfig,
  ) {
    this.logger.info(
      `Creating RateFetcher for ${this.dexKey} on network ${this.network}, isSlave=${this.dexHelper.config.isSlave}`,
    );
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

    this.rateFetcher = new Fetcher<HashflowRatesResponse>(
      dexHelper.httpRequest,
      {
        info: {
          requestOptions: config.rateConfig.pricesReqParams,
          requestFunc: async options => {
            const { filterMarketMakers, getCachedMarketMakers } =
              config.rateConfig;

            const cachedMarketMakers = (await getCachedMarketMakers()) || [];
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
  }

  start() {
    this.logger.info(
      `RateFetcher.start() called for ${this.dexKey} on network ${this.network}, isSlave=${this.dexHelper.config.isSlave}`,
    );
    this.logger.info(`Call stack: ${new Error().stack}`);
    this.marketMakersFetcher.startPolling();
    this.logger.info(
      `Started market makers fetcher polling for ${this.dexKey}`,
    );
    this.rateFetcher.startPolling();
    this.logger.info(`Started rates fetcher polling for ${this.dexKey}`);
  }

  stop() {
    this.marketMakersFetcher.stopPolling();
    this.rateFetcher.stopPolling();
    this.logger.info(
      `RateFetcher.stop() called for ${this.dexKey} on network ${this.network}, isSlave=${this.dexHelper.config.isSlave}`,
    );
    if (this.marketMakersFetcher.isPolling()) {
      this.logger.info(
        `Stopping market makers fetcher polling for ${this.dexKey}`,
      );
    } else {
      this.logger.info(
        `Market makers fetcher for ${this.dexKey} was not polling`,
      );
    }
    if (this.rateFetcher.isPolling()) {
      this.logger.info(`Stopping rates fetcher polling for ${this.dexKey}`);
    } else {
      this.logger.info(`Rates fetcher for ${this.dexKey} was not polling`);
    }
  }

  private handleMarketMakersResponse(resp: HashflowMarketMakersResponse): void {
    this.logger.debug(
      `Handling market makers response for ${this.dexKey}, isSlave=${this.dexHelper.config.isSlave}, received ${resp.marketMakers.length} market makers`,
    );
    const { marketMakers } = resp;
    this.dexHelper.cache.rawset(
      this.marketMakersCacheKey,
      JSON.stringify(marketMakers),
      this.marketMakersCacheTTL,
    );
    this.logger.debug(
      `Set ${marketMakers.length} market makers in cache with key ${this.marketMakersCacheKey} and TTL ${this.marketMakersCacheTTL}s`,
    );
  }

  private handleRatesResponse(resp: HashflowRatesResponse): void {
    const levelsCount = Object.keys(resp.levels).length;
    this.logger.debug(
      `Handling rates response for ${this.dexKey}, isSlave=${this.dexHelper.config.isSlave}, received levels for ${levelsCount} market makers`,
    );
    const { levels } = resp;
    this.dexHelper.cache.rawset(
      this.pricesCacheKey,
      JSON.stringify(levels),
      this.pricesCacheTTL,
    );
    this.logger.debug(
      `Set price levels in cache with key ${this.pricesCacheKey} and TTL ${this.pricesCacheTTL}s`,
    );
  }
}
