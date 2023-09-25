import { keyBy } from 'lodash';
import { IDexHelper, RequestConfig } from '../../dex-helper';
import { Fetcher } from '../../lib/fetcher/fetcher';
import { validateAndCast } from '../../lib/validators';
import { Address, Logger, Token } from '../../types';
import { NATIVE_QUOTE_TIMEOUT_MS, chainMap } from './constants';
import {
  NativeOrderType,
  NativePriceLevels,
  NativeQuoteRequest,
  NativeQuoteResponse,
  NativeRateFetcherConfig,
  NativeRatesResponse,
  NativeTokensResponse,
  TokensMap,
} from './types';
import {
  getQuoteResponseValidator,
  getTokensResponseValidator,
  levelsResponseValidator,
} from './validators';

export class RateFetcher {
  private rateFetcher: Fetcher<NativeRatesResponse>;
  private tokensFetcher: Fetcher<NativeTokensResponse>;
  private pricesCacheKey: string;
  private pricesCacheTTL: number;
  private tokensCacheTTL: number;
  private tokenCacheKey: string;

  constructor(
    private dexHelper: IDexHelper,
    private dexKey: string,
    private logger: Logger,
    config: NativeRateFetcherConfig,
  ) {
    this.pricesCacheKey = config.rateConfig.pricesCacheKey;
    this.pricesCacheTTL = config.rateConfig.pricesCacheTTLSecs;
    this.tokensCacheTTL = config.tokensConfig.tokensCacheTTLSecs;
    this.tokenCacheKey = config.tokensConfig.tokensCacheKey;

    this.rateFetcher = new Fetcher<NativeRatesResponse>(
      dexHelper.httpRequest,
      {
        info: {
          requestOptions: config.rateConfig.pricesReqParams,
          caster: (data: unknown) => {
            return validateAndCast<NativeRatesResponse>(
              data,
              levelsResponseValidator,
            );
          },
        },
        handler: this.handleRatesResponse.bind(this),
      },
      config.rateConfig.pricesIntervalMs,
      logger,
    );

    this.tokensFetcher = new Fetcher<NativeTokensResponse>(
      dexHelper.httpRequest,
      {
        info: {
          requestOptions: config.tokensConfig.tokensReqParams,
          caster: (data: unknown) => {
            return validateAndCast<NativeTokensResponse>(
              data,
              getTokensResponseValidator,
            );
          },
        },
        handler: this.handleTokensResponse.bind(this),
      },
      config.tokensConfig.tokensIntervalMs,
      logger,
    );
  }

  start() {
    this.rateFetcher.startPolling();
    this.tokensFetcher.startPolling();
  }

  stop() {
    this.rateFetcher.stopPolling();
    this.tokensFetcher.stopPolling();
  }

  private handleTokensResponse(resp: NativeTokensResponse): void {
    const tokensMap = resp.reduce((acc, token) => {
      acc[token.address.toLowerCase()] = {
        address: token.address,
        decimals: token.decimals,
        symbol: token.symbol,
      };
      return acc;
    }, {} as TokensMap);

    this.dexHelper.cache.setex(
      this.dexKey,
      this.dexHelper.config.data.network,
      this.tokenCacheKey,
      this.tokensCacheTTL,
      JSON.stringify(tokensMap),
    );
  }

  private handleRatesResponse(resp: NativeRatesResponse): void {
    const levels: Record<string, NativePriceLevels> = {};

    resp.map(pair => {
      if (!levels[`${pair.base_address}_${pair.quote_address}`]) {
        levels[`${pair.base_address}_${pair.quote_address}`] = {
          bids: [],
          asks: [],
          base: pair.base_address,
          quote: pair.quote_address,
        };
      }

      if (pair.side === 'bid') {
        levels[`${pair.base_address}_${pair.quote_address}`].bids =
          pair.levels.map(level => {
            return { level: level[0], price: level[1] };
          });
      } else if (pair.side === 'ask') {
        levels[`${pair.base_address}_${pair.quote_address}`].asks =
          pair.levels.map(level => {
            return { level: level[0], price: level[1] };
          });
      }
    });

    this.dexHelper.cache.setex(
      this.dexKey,
      this.dexHelper.config.data.network,
      this.pricesCacheKey,
      this.pricesCacheTTL,
      JSON.stringify(levels),
    );
  }

  async getQuote(
    networkId: number,
    _srcToken: Token,
    _destToken: Token,
    srcAmount: string,
    aggregatorRecipient: Address,
    requestParameters: RequestConfig,
  ): Promise<NativeQuoteResponse> {
    const srcToken = this.dexHelper.config.wrapETH(_srcToken);
    const destToken = this.dexHelper.config.wrapETH(_destToken);

    if (BigInt(srcAmount) === 0n) {
      throw new Error('geQuote failed with srcAmount == 0');
    }

    const _payload: NativeQuoteRequest = {
      taker: aggregatorRecipient,
      chain: chainMap[networkId as keyof typeof chainMap],
      baseToken: srcToken.address,
      quoteToken: destToken.address,
      amount: srcAmount,
      fee: 0,
    };

    try {
      let payload: RequestConfig = {
        data: _payload,
        ...requestParameters,
        timeout: NATIVE_QUOTE_TIMEOUT_MS,
      };

      this.logger.info(
        'GetQuote Request:',
        JSON.stringify(payload).replace(/(?:\r\n|\r|\n)/g, ' '),
      );
      const { data } = await this.dexHelper.httpRequest.request<unknown>(
        payload,
      );
      this.logger.info(
        'GetQuote Response: ',
        JSON.stringify(data).replace(/(?:\r\n|\r|\n)/g, ' '),
      );
      const quoteResp = validateAndCast<NativeQuoteResponse>(
        data,
        getQuoteResponseValidator,
      );

      return {
        from: quoteResp.from,
        calldata: quoteResp.calldata,
        to: quoteResp.to,
        struct: quoteResp.struct,
      };
    } catch (e) {
      this.logger.error(e);
      throw e;
    }
  }
}
