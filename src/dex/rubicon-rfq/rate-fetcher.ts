import { Network } from '../../constants';
import { IDexHelper } from '../../dex-helper';
import { Fetcher, SkippingRequest } from '../../lib/fetcher/fetcher';
import { validateAndCast } from '../../lib/validators';
import { Logger } from '../../types';
import {
  RubiconRfqMarketsResponse,
  RubiconRfqLiquidityResponse,
  RubiconRfqRateFetcherConfig,
} from './types';
import {
  marketsResponseValidator,
  liquidityResponseValidator,
} from './validators';

export class RateFetcher {
  private liquidityFetcher: Fetcher<RubiconRfqLiquidityResponse>;
  private rateFetcher: Fetcher<RubiconRfqMarketsResponse>;

  private marketsCacheKey: string;
  private marketsCacheTTL: number;

  private liquidityCacheKey: string;
  private liquidityCacheTTL: number;

  constructor(
    private dexHelper: IDexHelper,
    private dexKey: string,
    private network: Network,
    private logger: Logger,
    config: RubiconRfqRateFetcherConfig,
  ) {
    this.marketsCacheKey = config.rateConfig.marketsCacheKey;
    this.marketsCacheTTL = config.rateConfig.marketsCacheTTLSecs;

    this.liquidityCacheKey = config.rateConfig.liquidityCacheKey;
    this.liquidityCacheTTL = config.rateConfig.liquidityCacheTTLSecs;

    this.liquidityFetcher = new Fetcher<RubiconRfqLiquidityResponse>(
      dexHelper.httpRequest,
      {
        info: {
          requestOptions: config.rateConfig.marketsReqParams,
          requestFunc: async options => {
            const { liquidityReqParams } = config.rateConfig;

            options.url = liquidityReqParams.url;
            options.params = liquidityReqParams.params;

            const liquidity = await dexHelper.httpRequest.request(options);

            return liquidity;
          },
          caster: (data: unknown) => {
            return validateAndCast<RubiconRfqLiquidityResponse>(
              data,
              liquidityResponseValidator,
            );
          },
        },
        handler: this.handleLiquidityResponse.bind(this),
      },
      config.rateConfig.marketsIntervalMs,
      logger,
    );

    this.rateFetcher = new Fetcher<RubiconRfqMarketsResponse>(
      dexHelper.httpRequest,
      {
        info: {
          requestOptions: config.rateConfig.marketsReqParams,
          requestFunc: async options => {
            const { marketsReqParams } = config.rateConfig;

            options.url = marketsReqParams.url;
            options.params = marketsReqParams.params;

            const markets = await dexHelper.httpRequest.request(options);

            return markets;
          },
          caster: (data: unknown) => {
            return validateAndCast<RubiconRfqMarketsResponse>(
              data,
              marketsResponseValidator,
            );
          },
        },
        handler: this.handleMarketsResponse.bind(this),
      },
      config.rateConfig.marketsIntervalMs,
      logger,
    );
  }

  start() {
    this.liquidityFetcher.startPolling();
    this.rateFetcher.startPolling();
  }

  stop() {
    this.liquidityFetcher.stopPolling();
    this.rateFetcher.stopPolling();
  }

  private handleMarketsResponse(resp: RubiconRfqMarketsResponse): void {
    const { markets } = resp;
    this.dexHelper.cache.rawset(
      this.marketsCacheKey,
      JSON.stringify(markets),
      this.marketsCacheTTL,
    );
  }

  private handleLiquidityResponse(resp: RubiconRfqLiquidityResponse): void {
    const { liquidityUsd } = resp;
    this.dexHelper.cache.rawset(
      this.liquidityCacheKey,
      JSON.stringify(liquidityUsd),
      this.liquidityCacheTTL,
    );
  }
}
