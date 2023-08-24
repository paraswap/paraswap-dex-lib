import { IDexHelper } from '../../dex-helper';
import { Fetcher } from '../../lib/fetcher/fetcher';
import { validateAndCast } from '../../lib/validators';
import { Logger, Token } from '../../types';
import {
  DexalotRateFetcherConfig,
  DexalotPairsResponse,
  PairDataMap,
  DexalotPricesResponse,
  PriceDataMap,
  DexalotTokensResponse,
  DexalotBlacklistResponse,
} from './types';
import {
  pricesResponseValidator,
  pairsResponseValidator,
  tokensResponseValidator,
  blacklistResponseValidator,
} from './validators';
import { Network } from '../../constants';

export class RateFetcher {
  private pairsFetcher: Fetcher<DexalotPairsResponse>;
  private pairsCacheKey: string;
  private pairsCacheTTL: number;

  private rateFetcher: Fetcher<DexalotPricesResponse>;
  private pricesCacheKey: string;
  private pricesCacheTTL: number;

  private tokensFetcher: Fetcher<DexalotTokensResponse>;
  private tokensAddrCacheKey: string;
  private tokensCacheKey: string;
  private tokensCacheTTL: number;

  private blacklistFetcher: Fetcher<DexalotBlacklistResponse>;
  private blacklistCacheKey: string;

  constructor(
    private dexHelper: IDexHelper,
    private dexKey: string,
    private network: Network,
    private logger: Logger,
    config: DexalotRateFetcherConfig,
  ) {
    this.pairsCacheKey = config.rateConfig.pairsCacheKey;
    this.pairsCacheTTL = config.rateConfig.pairsCacheTTLSecs;
    this.pricesCacheKey = config.rateConfig.pricesCacheKey;
    this.pricesCacheTTL = config.rateConfig.pricesCacheTTLSecs;
    this.tokensAddrCacheKey = config.rateConfig.tokensAddrCacheKey;
    this.tokensCacheKey = config.rateConfig.tokensCacheKey;
    this.tokensCacheTTL = config.rateConfig.tokensCacheTTLSecs;
    this.blacklistCacheKey = config.rateConfig.blacklistCacheKey;

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

    this.tokensFetcher = new Fetcher<DexalotTokensResponse>(
      dexHelper.httpRequest,
      {
        info: {
          requestOptions: config.rateConfig.tokensReqParams,
          caster: (data: unknown) => {
            return validateAndCast<DexalotTokensResponse>(
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
    this.tokensFetcher.startPolling();
    this.blacklistFetcher.startPolling();
  }

  stop() {
    this.pairsFetcher.stopPolling();
    this.rateFetcher.stopPolling();
    this.tokensFetcher.stopPolling();
    this.blacklistFetcher.stopPolling();
  }

  private handlePairsResponse(resp: DexalotPairsResponse): void {
    const { pairs } = resp;
    const dexPairs: PairDataMap = {};
    Object.keys(pairs).forEach(pair => {
      dexPairs[pair.toLowerCase()] = pairs[pair];
    });
    this.dexHelper.cache.setex(
      this.dexKey,
      this.network,
      this.pairsCacheKey,
      this.pairsCacheTTL,
      JSON.stringify(dexPairs),
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

  private handleTokensResponse(resp: DexalotTokensResponse): void {
    const { tokens } = resp;
    const tokenMap: { [address: string]: Token } = {};
    const tokenAddrMap: { [pair: string]: string } = {};
    Object.keys(tokens).forEach(symbol => {
      const token = tokens[symbol];
      tokenMap[token.address.toLowerCase()] = {
        address: token.address.toLowerCase(),
        symbol: token.symbol,
        decimals: token.decimals,
      };
      tokenAddrMap[token.symbol.toLowerCase()] = token.address.toLowerCase();
    });
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

  private async handleBlacklistResponse(
    resp: DexalotBlacklistResponse,
  ): Promise<void> {
    const { blacklist } = resp;
    for (const address of blacklist) {
      this.dexHelper.cache.sadd(this.blacklistCacheKey, address.toLowerCase());
    }
  }
}
