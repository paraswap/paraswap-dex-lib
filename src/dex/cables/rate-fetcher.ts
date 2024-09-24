import { Network } from '../../constants';
import { IDexHelper } from '../../dex-helper';
import { Fetcher } from '../../lib/fetcher/fetcher';
import { validateAndCast } from '../../lib/validators';
import { Logger, Token } from '../../types';
import { PairData } from '../cables/types';
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
  public blacklistCacheKey: string;
  public blacklistCacheTTL: number;

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
  }

  /**
   * Utils
   */
  start() {
    this.pairsFetcher.startPolling();
    this.pricesFetcher.startPolling();
    this.blacklistFetcher.startPolling();
    this.tokensFetcher.startPolling();
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

    // console.log("===> pairs DEBUG:", pairs);
    // process.exit(0);

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
  }

  private handlePricesResponse(res: CablesPricesResponse): void {
    // console.log('PRICES RESPONSE', res);
    // console.log(JSON.stringify(res))
    // console.log('Network:', this.network);
    // process.exit(0);

    const networkId = String(this.network);
    const prices = res.prices[networkId];

    // console.log("===> prices DEBUG:", prices);
    // process.exit(0);

    this.dexHelper.cache.setex(
      this.dexKey,
      this.network,
      this.pricesCacheKey,
      this.pricesCacheTTL,
      JSON.stringify(prices),
    );
  }

  private handleBlacklistResponse(res: CablesBlacklistResponse): void {
    const { blacklist } = res;
    this.dexHelper.cache.setex(
      this.dexKey,
      this.network,
      this.blacklistCacheKey,
      this.blacklistCacheTTL,
      JSON.stringify(blacklist.map(item => item.toLowerCase())),
    );
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

  private handleTokensResponse(res: CablesTokensResponse): void {
    const networkId = String(this.network);
    const tokens = res.tokens[networkId];

    // console.log("===> tokens DEBUG:", tokens);

    const normalized_tokens = this.normalizeAddressesToLowerCase(tokens);

    // console.log("===> tokens DEBUG:", normalized_tokens);
    // process.exit(0);

    this.dexHelper.cache.setex(
      this.dexKey,
      this.network,
      this.tokensCacheKey,
      this.tokensCacheTTL,
      JSON.stringify(normalized_tokens),
    );
  }
}
