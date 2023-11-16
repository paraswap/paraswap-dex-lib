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
    this.marketMakersFetcher.startPolling();
    this.rateFetcher.startPolling();
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
    this.dexHelper.cache.rawset(
      this.pricesCacheKey,
      JSON.stringify(levels),
      this.pricesCacheTTL,
    );
  }
}
