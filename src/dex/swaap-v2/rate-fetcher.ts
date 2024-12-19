import { IDexHelper } from '../../dex-helper';
import { Fetcher } from '../../lib/fetcher/fetcher';
import { validateAndCast } from '../../lib/validators';
import { Logger, Token, Address } from '../../types';
import {
  SwaapV2RateFetcherConfig,
  SwaapV2PriceLevelsResponse,
  SwaapV2QuoteResponse,
  SwaapV2PriceLevels,
  SwaapV2QuoteRequest,
  SwaapV2OrderType,
  SwaapV2TokensResponse,
  TokensMap,
  SwaapV2NotificationRequest,
  SwaapV2NotificationResponse,
} from './types';
import {
  priceLevelsResponseValidator,
  getTokensResponseValidator,
  notifyResponseValidator,
  getQuoteResponseWithRecipientValidator,
} from './validators';
import { normalizeTokenAddress } from './utils';
import {
  SWAAP_RFQ_QUOTE_TIMEOUT_MS,
  SWAAP_NOTIFY_TIMEOUT_MS,
  SWAAP_NOTIFICATION_ORIGIN,
  SWAAP_TOKENS_CACHE_KEY,
  SWAAP_PRICES_CACHE_KEY,
  SWAAP_403_TTL_S,
  SWAAP_POOL_RESTRICT_TTL_S,
} from './constants';
import { RequestConfig } from '../../dex-helper/irequest-wrapper';
import { Network } from '../../constants';
import { ExpKeyValuePubSub, NonExpSetPubSub } from '../../lib/pub-sub';

const BLACKLISTED = 'blacklisted';

export class RateFetcher {
  private rateFetcher: Fetcher<SwaapV2PriceLevelsResponse>;
  private tokensFetcher: Fetcher<SwaapV2TokensResponse>;
  private pricesCacheTTL: number;
  private tokensCacheTTL: number;
  private tokenCacheKey: string;
  private pricesCacheKey: string;

  private rateTokensPubSub: ExpKeyValuePubSub;
  private restrictedPubSub: ExpKeyValuePubSub;
  private blacklistPubSub: NonExpSetPubSub;

  constructor(
    private dexHelper: IDexHelper,
    private network: Network,
    private dexKey: string,
    private logger: Logger,
    config: SwaapV2RateFetcherConfig,
  ) {
    this.pricesCacheTTL = config.rateConfig.pricesCacheTTLSecs;
    this.tokensCacheTTL = config.tokensConfig.tokensCacheTTLSecs;
    this.pricesCacheKey = config.rateConfig.pricesCacheKey;
    this.tokenCacheKey = config.tokensConfig.tokensCacheKey;

    this.rateTokensPubSub = new ExpKeyValuePubSub(
      this.dexHelper,
      this.dexKey,
      'rateTokens',
    );

    this.rateFetcher = new Fetcher<SwaapV2PriceLevelsResponse>(
      dexHelper.httpRequest,
      {
        info: {
          requestOptions: config.rateConfig.pricesReqParams,
          caster: (data: unknown) => {
            return validateAndCast<SwaapV2PriceLevelsResponse>(
              data,
              priceLevelsResponseValidator,
            );
          },
        },
        handler: this.handleRatesResponse.bind(this),
      },
      config.rateConfig.pricesIntervalMs,
      logger,
    );

    this.tokensFetcher = new Fetcher<SwaapV2TokensResponse>(
      dexHelper.httpRequest,
      {
        info: {
          requestOptions: config.tokensConfig.tokensReqParams,
          caster: (data: unknown) => {
            return validateAndCast<SwaapV2TokensResponse>(
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

    this.restrictedPubSub = new ExpKeyValuePubSub(
      this.dexHelper,
      this.dexKey,
      'restricted',
      'pool_is_not_restricted',
      SWAAP_POOL_RESTRICT_TTL_S,
    );

    this.blacklistPubSub = new NonExpSetPubSub(
      this.dexHelper,
      this.dexKey,
      'blacklist',
    );
  }

  async start() {
    if (!this.dexHelper.config.isSlave) {
      this.rateFetcher.startPolling();
      this.tokensFetcher.startPolling();
    } else {
      this.rateTokensPubSub.subscribe();
      this.restrictedPubSub.subscribe();

      const initSet = await this.getAllBlacklisted();
      this.blacklistPubSub.initializeAndSubscribe(initSet);
    }
  }

  stop() {
    this.rateFetcher.stopPolling();
    this.tokensFetcher.startPolling();
  }

  private handleTokensResponse(resp: SwaapV2TokensResponse): void {
    if (!resp.success) {
      return;
    }

    const tokensMap = Object.keys(resp.tokens).reduce((acc, key: string) => {
      acc[key.toLowerCase()] = resp.tokens[key];
      return acc;
    }, {} as TokensMap);

    this.dexHelper.cache.setex(
      this.dexKey,
      this.dexHelper.config.data.network,
      this.tokenCacheKey,
      this.tokensCacheTTL,
      JSON.stringify(tokensMap),
    );

    this.rateTokensPubSub.publish(
      { [this.tokenCacheKey]: tokensMap },
      this.tokensCacheTTL,
    );
  }

  private handleRatesResponse(resp: SwaapV2PriceLevelsResponse): void {
    if (!resp.success) {
      return;
    }

    const levels = Object.keys(resp.levels).reduce<
      Record<string, SwaapV2PriceLevels>
    >((memo, pairName) => {
      const pair = resp.levels[pairName];
      if (!pair) {
        return memo;
      }

      if (!pair.asks || !pair.bids) {
        return memo;
      }

      const pairSplit = pairName.split('/');
      const baseAddress = pairSplit[0];
      const quoteAddress = pairSplit[1];
      pair.base = normalizeTokenAddress(baseAddress);
      pair.quote = normalizeTokenAddress(quoteAddress);

      memo[pairName] = pair;

      return memo;
    }, {});

    this.dexHelper.cache.setex(
      this.dexKey,
      this.dexHelper.config.data.network,
      this.pricesCacheKey,
      this.pricesCacheTTL,
      JSON.stringify(levels),
    );

    this.rateTokensPubSub.publish(
      { [this.pricesCacheKey]: levels },
      this.pricesCacheTTL,
    );
  }

  async getQuote(
    networkId: number,
    _srcToken: Token,
    _destToken: Token,
    srcAmount: string,
    side: SwaapV2OrderType,
    userAddress: Address,
    sender: Address,
    recipient: Address,
    tolerance: number,
    requestParameters: RequestConfig,
  ): Promise<SwaapV2QuoteResponse> {
    const srcToken = this.dexHelper.config.wrapETH(_srcToken);
    const destToken = this.dexHelper.config.wrapETH(_destToken);

    if (BigInt(srcAmount) === 0n) {
      throw new Error('geQuote failed with srcAmount == 0');
    }

    const _payload: SwaapV2QuoteRequest = {
      network_id: networkId,
      origin: userAddress,
      sender,
      recipient,
      timestamp: Math.round(Date.now() / 1000),
      order_type: side,
      token_in: srcToken.address,
      token_out: destToken.address,
      amount: srcAmount,
      tolerance: tolerance,
    };

    try {
      let payload: RequestConfig = {
        data: _payload,
        ...requestParameters,
        timeout: SWAAP_RFQ_QUOTE_TIMEOUT_MS,
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
      const quoteResp = validateAndCast<SwaapV2QuoteResponse>(
        data,
        getQuoteResponseWithRecipientValidator(recipient),
      );

      return {
        id: quoteResp.id,
        calldata: quoteResp.calldata,
        router: quoteResp.router,
        expiration: quoteResp.expiration,
        amount: quoteResp.amount,
        guaranteed_price: quoteResp.guaranteed_price,
        success: quoteResp.success,
        recipient: quoteResp.recipient,
      };
    } catch (e) {
      this.logger.error(e);
      throw e;
    }
  }

  async notify(
    code: number,
    message: string,
    requestParameters: RequestConfig,
  ): Promise<SwaapV2NotificationResponse> {
    const _payload: SwaapV2NotificationRequest = {
      origin: SWAAP_NOTIFICATION_ORIGIN,
      code: code,
      message: message,
    };

    try {
      let payload: RequestConfig = {
        data: _payload,
        ...requestParameters,
        timeout: SWAAP_NOTIFY_TIMEOUT_MS,
      };

      this.logger.info(
        'Notify Request:',
        JSON.stringify(payload).replace(/(?:\r\n|\r|\n)/g, ' '),
      );
      const { data } = await this.dexHelper.httpRequest.request<unknown>(
        payload,
      );
      this.logger.info(
        'Notify Response: ',
        JSON.stringify(data).replace(/(?:\r\n|\r|\n)/g, ' '),
      );
      const notifyResp = validateAndCast<SwaapV2NotificationResponse>(
        data,
        notifyResponseValidator,
      );

      return {
        success: notifyResp.success,
      };
    } catch (e) {
      this.logger.error(e);
      throw e;
    }
  }

  async getCachedTokens(): Promise<TokensMap | null> {
    const cachedTokens = await this.rateTokensPubSub.getAndCache(
      this.tokenCacheKey,
    );

    if (cachedTokens) {
      return cachedTokens as TokensMap;
    }

    return null;
  }

  async getCachedLevels(): Promise<Record<string, SwaapV2PriceLevels> | null> {
    const cachedLevels = await this.rateTokensPubSub.getAndCache(
      this.pricesCacheKey,
    );

    if (cachedLevels) {
      return cachedLevels as Record<string, SwaapV2PriceLevels>;
    }

    return null;
  }

  async isBlacklisted(txOrigin: Address): Promise<boolean> {
    const fallback = async () => {
      const value = await this.dexHelper.cache.get(
        this.dexKey,
        this.network,
        this.getBlackListKey(txOrigin),
      );
      return value === BLACKLISTED;
    };

    return this.blacklistPubSub.has(txOrigin.toLowerCase(), fallback);
  }

  getBlackListKey(address: Address) {
    return `blacklist_${address}`.toLowerCase();
  }

  async setBlacklist(
    txOrigin: Address,
    ttl: number = SWAAP_403_TTL_S,
  ): Promise<boolean> {
    await this.dexHelper.cache.setex(
      this.dexKey,
      this.network,
      this.getBlackListKey(txOrigin),
      ttl,
      BLACKLISTED,
    );

    this.blacklistPubSub.publish([txOrigin.toLowerCase()]);
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

  getAddressFromBlackListKey(key: Address) {
    return (key.split('blacklist_')[1] ?? '').toLowerCase();
  }

  async restrictPool(poolIdentifier: string): Promise<void> {
    await this.restrictedPubSub.publish(
      { [this.getRestrictPoolKey(poolIdentifier)]: 'restricted' },
      SWAAP_POOL_RESTRICT_TTL_S,
    );
  }

  async isRestrictedPool(poolIdentifier: string): Promise<boolean> {
    const restricted = await this.restrictedPubSub.getAndCache(
      this.getRestrictPoolKey(poolIdentifier),
    );
    return restricted === 'restricted';
  }

  getRestrictPoolKey(poolIdentifier: string): string {
    return `restricted_mms_${poolIdentifier}`;
  }
}
