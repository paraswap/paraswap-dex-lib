import { IDexHelper } from '../../dex-helper';
import Fetcher from '../../lib/fetcher/fetcher';
import { validateAndCast } from '../../lib/validators';
import { Logger } from '../../types';
import { HashflowRateFetcherConfig, HashflowRatesResponse, HashflowMarketMakersResponse } from './types';
import { pricesResponseValidator, marketMakersValidator } from './validators';
import { Network } from '../../constants';

export class RateFetcher {
  private rateFetcher: Fetcher<HashflowRatesResponse>;
  private pricesCacheKey: string;
  private pricesCacheTTL: number;
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

    this.rateFetcher = new Fetcher<HashflowRatesResponse>(
      dexHelper.httpRequest,
      {
        info: {
          requestOptions: config.rateConfig.pricesReqParams,
          requestFunc: async (options) => {
            const marketMakersResponse =  await dexHelper.httpRequest.request({
              ...config.rateConfig.marketMakersReqParams,
            });
            const parsedData = validateAndCast<HashflowMarketMakersResponse>(marketMakersResponse.data, marketMakersValidator);
            this.handleMarketMakersResponse(parsedData);
            const { marketMakers } = parsedData;
            const filteredMarketMakers = await config.rateConfig.filterMarketMakers(marketMakers);

            if(filteredMarketMakers.length === 0) {
              return Promise.reject(new Error(
                `${dexKey}-${network}: got ${filteredMarketMakers.length} market makers. Skipping pricing request.`,
              ));
            }

            const prices = await dexHelper.httpRequest.request({
              ...options,
              params: { ...options.params, marketMakers: filteredMarketMakers },
            })

            return prices;
          },
          caster: (data: unknown) => {
            return validateAndCast<HashflowRatesResponse>(data, pricesResponseValidator);
          },
        },
        handler: this.handleRatesResponse.bind(this),
      },
      config.rateConfig.intervalMs,
      logger,
    );
  }

  start() {
    this.rateFetcher.startPolling();
  }

  stop() {
    this.rateFetcher.stopPolling();
  }

  private handleMarketMakersResponse(resp: HashflowMarketMakersResponse): void {
    const { marketMakers } = resp;
    this.dexHelper.cache.rawset(this.marketMakersCacheKey, JSON.stringify(marketMakers), this.marketMakersCacheTTL);
  }

  private handleRatesResponse(resp: HashflowRatesResponse): void {
    const { levels } = resp;
    this.dexHelper.cache.rawset(this.pricesCacheKey, JSON.stringify(levels), this.pricesCacheTTL)
  }

  checkHealth(): boolean {
    return this.rateFetcher.lastFetchSucceeded;
  }
}
