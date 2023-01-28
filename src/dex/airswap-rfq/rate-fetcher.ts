import BigNumber from 'bignumber.js';
import { SwapSide } from '@paraswap/core';
import { BN_1 } from '../../bignumber-constants';
import { IDexHelper } from '../../dex-helper';
import { RequestConfig } from '../../dex-helper/irequest-wrapper';
import Fetcher from '../../lib/fetcher/fetcher';

import { Logger, Address, Token } from '../../types';
import { OrderInfo } from '../paraswap-limit-orders/types';
import {
  PairMap,
  PairsResponse,
  PriceAndAmount,
  PriceAndAmountBigNumber,
  RatesResponse,
  RFQConfig,
  RFQFirmRateResponse,
  RFQPayload,
  TokensResponse,
} from './types';
import { checkOrder } from './utils';
import {
  blacklistResponseValidator,
  firmRateResponseValidator,
  pricesResponse,
  tokensResponseValidator,
  tokenValidator,
  validateAndCast,
} from './validators';
import { airswapRFQAuthHttp } from './security';

const GET_FIRM_RATE_TIMEOUT_MS = 2000;

export const reversePrice = (price: PriceAndAmountBigNumber) =>
  [
    BN_1.dividedBy(price[0]),
    price[1].times(price[0]),
  ] as PriceAndAmountBigNumber;

export class RateFetcher {
  private tokensFetcher: Fetcher<TokensResponse>;

  private tokens: Record<string, any> = {};
  private addressToTokenMap: Record<string, any> = {};
  private pairs: PairMap = {};

  private firmRateAuth?: (options: RequestConfig) => void;

  constructor(
    private dexHelper: IDexHelper,
    private config: RFQConfig,
    private dexKey: string,
    private logger: Logger,
  ) {
    this.tokensFetcher = new Fetcher<TokensResponse>(
      dexHelper.httpRequest,
      {
        info: {
          requestOptions: config.tokensConfig.reqParams,
          caster: (data: unknown) => {
            return validateAndCast<TokensResponse>(data, tokenValidator);
          },
        },
        handler: this.handleTokensResponse.bind(this),
      },
      config.tokensConfig.intervalMs,
      this.logger,
    );
  }

  start() {
    this.tokensFetcher.startPolling();
  }

  stop() {
    this.tokensFetcher.stopPolling();
  }

  private handleTokensResponse(data: TokensResponse) {
    for (const pricing of data.pricing) {
      // token.address = token.address.toLowerCase();
      this.tokens[pricing.baseToken] = pricing;
      if (pricing.bid?.length) {
        this.dexHelper.cache.setex(
          this.dexKey,
          this.dexHelper.config.data.network,
          `${pricing.baseToken}_${pricing.quoteToken}_bids`,
          200, //this.config.rateConfig.dataTTLS,
          JSON.stringify(pricing.bid),
        );
      }

      if (pricing.ask?.length) {
        this.dexHelper.cache.setex(
          this.dexKey,
          this.dexHelper.config.data.network,
          `${pricing.baseToken}_${pricing.quoteToken}_asks`,
          200, //this.config.rateConfig.dataTTLS,
          JSON.stringify(pricing.ask),
        );
      }
    }

    this.addressToTokenMap = Object.keys(this.tokens).reduce((acc, key) => {
      const obj = this.tokens[key];
      if (!obj) {
        return acc;
      }
      acc[obj.baseToken.toLowerCase()] = obj;
      return acc;
    }, {} as Record<string, any>);
  }

  checkHealth(): boolean {
    return [this.tokensFetcher, {} as any].some(f => f.lastFetchSucceeded);
  }

  // public getPairsLiquidity(tokenAddress: string) {
  //   const token = this.addressToTokenMap[tokenAddress];

  //   const pairNames = Object.keys(this.pairs);
  //   const pairs = Object.values(this.pairs);

  //   return pairs
  //     .filter((p, index) => pairNames[index].includes(token.symbol!))
  //     .map(p => {
  //       const baseToken = this.tokens[p.base];
  //       const quoteToken = this.tokens[p.quote];
  //       let connectorToken: Token | undefined;
  //       if (baseToken.address !== tokenAddress) {
  //         connectorToken = {
  //           address: baseToken.address,
  //           decimals: baseToken.decimals,
  //         };
  //       } else {
  //         connectorToken = {
  //           address: quoteToken.address,
  //           decimals: quoteToken.decimals,
  //         };
  //       }
  //       return {
  //         connectorTokens: [connectorToken],
  //         liquidityUSD: p.liquidityUSD,
  //       };
  //     });
  // }

  public async getOrderPrice(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
  ): Promise<PriceAndAmountBigNumber[] | null> {
    let reversed = false;
    await this.tokensFetcher.fetch(true);
    let pricesAsString: string | null = null;
    if (side === SwapSide.SELL) {
      pricesAsString = await this.dexHelper.cache.get(
        this.dexKey,
        this.dexHelper.config.data.network,
        `${srcToken.address}_${destToken.address}_bids`,
      );

      if (!pricesAsString) {
        pricesAsString = await this.dexHelper.cache.get(
          this.dexKey,
          this.dexHelper.config.data.network,
          `${destToken.address}_${srcToken.address}_asks`,
        );
        reversed = true;
      }
    } else {
      pricesAsString = await this.dexHelper.cache.get(
        this.dexKey,
        this.dexHelper.config.data.network,
        `${destToken.address}_${srcToken.address}_asks`,
      );

      if (!pricesAsString) {
        pricesAsString = await this.dexHelper.cache.get(
          this.dexKey,
          this.dexHelper.config.data.network,
          `${srcToken.address}_${destToken.address}_bids`,
        );
        reversed = true;
      }
    }

    if (!pricesAsString) {
      return null;
    }

    const orderPricesAsString: PriceAndAmount[] = JSON.parse(pricesAsString);
    if (!orderPricesAsString) {
      return null;
    }

    let orderPrices = orderPricesAsString.map(price => [
      new BigNumber(price[0]),
      new BigNumber(price[1]),
    ]);

    if (reversed) {
      orderPrices = orderPrices.map(price =>
        reversePrice(price as PriceAndAmountBigNumber),
      );
    }

    return orderPrices as PriceAndAmountBigNumber[];
  }

  async getFirmRate(
    _srcToken: Token,
    _destToken: Token,
    srcAmount: string,
    side: SwapSide,
    userAddress: Address,
  ): Promise<OrderInfo> {
    const srcToken = this.dexHelper.config.wrapETH(_srcToken);
    const destToken = this.dexHelper.config.wrapETH(_destToken);

    if (BigInt(srcAmount) === 0n) {
      throw new Error('getFirmRate failed with srcAmount == 0');
    }

    const _payload: RFQPayload = {
      makerAsset: destToken.address,
      takerAsset: srcToken.address,
      makerAmount: side === SwapSide.BUY ? srcAmount : undefined,
      takerAmount: side === SwapSide.SELL ? srcAmount : undefined,
      userAddress,
    };

    try {
      let payload = {
        data: _payload,
        timeout: GET_FIRM_RATE_TIMEOUT_MS,
      };

      if (this.firmRateAuth) {
        this.firmRateAuth(payload);
      }

      const { data } = await this.dexHelper.httpRequest.request<unknown>(
        payload,
      );

      const firmRateResp = validateAndCast<RFQFirmRateResponse>(
        data,
        firmRateResponseValidator,
      );

      await checkOrder(
        this.dexHelper.config.data.network,
        this.dexHelper.config.data.augustusRFQAddress,
        this.dexHelper.multiWrapper,
        firmRateResp.order,
      );

      return {
        order: {
          maker: firmRateResp.order.maker,
          taker: firmRateResp.order.taker,
          expiry: firmRateResp.order.expiry,
          nonceAndMeta: firmRateResp.order.nonceAndMeta,
          makerAsset: firmRateResp.order.makerAsset,
          takerAsset: firmRateResp.order.takerAsset,
          makerAmount: firmRateResp.order.makerAmount,
          takerAmount: firmRateResp.order.takerAmount,
        },
        signature: firmRateResp.order.signature,
        takerTokenFillAmount: firmRateResp.order.takerAmount,
        permitMakerAsset: '0x',
        permitTakerAsset: '0x',
      };
    } catch (e) {
      this.logger.error(e);
      throw e;
    }
  }
}
