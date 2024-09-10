import { ETHER_ADDRESS, Network } from '../../constants';
import { IDexHelper } from '../../dex-helper';
import { Fetcher, SkippingRequest } from '../../lib/fetcher/fetcher';
import { validateAndCast } from '../../lib/validators';
import { Logger, Token } from '../../types';
import {
  BebopPricingResponse,
  BebopRateFetcherConfig,
  BebopTokensResponse,
} from './types';
import { pricesResponseValidator, tokensResponseValidator } from './validators';
import { WebSocketFetcher } from './websocket-fetcher';

export class RateFetcher {
  private pricesFetcher: WebSocketFetcher<BebopPricingResponse>;
  private pricesCacheKey: string;
  private pricesCacheTTL: number;

  private tokensFetcher: Fetcher<BebopTokensResponse>;
  private tokensAddrCacheKey: string;
  private tokensCacheKey: string;
  private tokensCacheTTL: number;

  constructor(
    private dexHelper: IDexHelper,
    private dexKey: string,
    private network: Network,
    private logger: Logger,
    config: BebopRateFetcherConfig,
  ) {
    this.pricesCacheKey = config.rateConfig.pricesCacheKey;
    this.pricesCacheTTL = config.rateConfig.pricesCacheTTLSecs;
    this.pricesFetcher = new WebSocketFetcher<BebopPricingResponse>(
      {
        info: {
          requestOptions: config.rateConfig.pricesReqParams,
          caster: (data: unknown) => {
            return validateAndCast<BebopPricingResponse>(
              data,
              pricesResponseValidator,
            );
          },
        },
        handler: this.handlePricesResponse.bind(this),
      },
      logger,
    );

    this.tokensAddrCacheKey = config.rateConfig.tokensAddrCacheKey;
    this.tokensCacheKey = config.rateConfig.tokensCacheKey;
    this.tokensCacheTTL = config.rateConfig.tokensCacheTTLSecs;
    this.tokensFetcher = new Fetcher<BebopTokensResponse>(
      dexHelper.httpRequest,
      {
        info: {
          requestOptions: config.rateConfig.tokensReqParams,
          caster: (data: unknown) => {
            return validateAndCast<BebopTokensResponse>(
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

  start() {
    this.pricesFetcher.startPolling();
    this.tokensFetcher.startPolling();
  }

  stop() {
    this.pricesFetcher.stopPolling();
    this.tokensFetcher.stopPolling();
  }

  private handleTokensResponse(resp: BebopTokensResponse): void {
    const tokenMap: { [address: string]: Token } = {};
    const tokenAddrMap: { [symbol: string]: Token } = {};

    Object.keys(resp.tokens).forEach(tokenSymbol => {
      const token = resp.tokens[tokenSymbol];
      const tokenData = {
        address: token.contractAddress.toLowerCase(),
        symbol: token.ticker,
        decimals: token.decimals,
      };
      tokenAddrMap[token.contractAddress.toLowerCase()] = tokenData;
      tokenMap[token.ticker.toLowerCase()] = tokenData;
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

  private handlePricesResponse(resp: BebopPricingResponse): void {
    const wethAddress =
      this.dexHelper.config.data.wrappedNativeTokenAddress.toLowerCase();
    const normalizedPrices: BebopPricingResponse = {};
    for (const [pair, levels] of Object.entries(resp)) {
      normalizedPrices[pair.toLowerCase()] = levels;
      const [base, quote] = pair.split('/');
      // Also enter native token prices. Pricing doesn't come with these
      if (
        base.toLowerCase() === wethAddress ||
        quote.toLowerCase() === wethAddress
      ) {
        const nativePair = pair.replace(base, ETHER_ADDRESS);
        normalizedPrices[nativePair.toLowerCase()] = levels;
      }
    }

    this.dexHelper.cache.setex(
      this.dexKey,
      this.network,
      this.pricesCacheKey,
      this.pricesCacheTTL,
      JSON.stringify(normalizedPrices),
    );
  }
}
