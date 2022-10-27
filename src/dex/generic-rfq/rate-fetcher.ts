import BigNumber from 'bignumber.js';
import { SwapSide } from 'paraswap-core';
import { BN_0, BN_1 } from '../../bignumber-constants';
import { IDexHelper } from '../../dex-helper';
import Fetcher from '../../lib/fetcher/fetcher';
import { Logger, Address, Token } from '../../types';
import { OrderInfo } from '../paraswap-limit-orders/types';
import {
  MarketResponse,
  PairMap,
  PriceAndAmount,
  PriceAndAmountBigNumber,
  RatesResponse,
  RFQConfig,
  RFQFirmRateResponse,
  RFQPayload,
} from './types';

export const FIRM_RATE_TIMEOUT_MS = 500;

export const reversePrice = (price: PriceAndAmountBigNumber) =>
  ({
    amount: price.amount.times(price.price),
    price: BN_1.dividedBy(price.price),
  } as PriceAndAmountBigNumber);

export class RateFetcher {
  private augustusAddress: Address;

  private marketFetcher: Fetcher<MarketResponse>;
  private rateFetcher: Fetcher<RatesResponse>;

  private pairs: PairMap = {};

  constructor(
    private dexHelper: IDexHelper,
    private config: RFQConfig,
    private dexKey: string,
    private logger: Logger,
  ) {
    this.augustusAddress = dexHelper.config.data.augustusAddress.toLowerCase();

    this.marketFetcher = new Fetcher<MarketResponse>(
      dexHelper.httpRequest,
      {
        info: {
          requestOptions: config.marketConfig.reqParams,
          caster: this.castMarketResponse.bind(this),
        },
        handler: this.handleMarketResponse.bind(this),
      },
      config.marketConfig.intervalMs,
      this.logger,
    );

    this.rateFetcher = new Fetcher<RatesResponse>(
      dexHelper.httpRequest,
      {
        info: {
          requestOptions: config.rateConfig.reqParams,
          caster: this.castRateResponse.bind(this),
        },
        handler: this.handleRatesResponse.bind(this),
      },
      config.rateConfig.intervalMs,
      logger,
    );
  }

  private castMarketResponse(data: unknown): MarketResponse | null {
    if (!data || typeof data !== 'object') {
      return null;
    }

    const parsed = data as MarketResponse;
    if (!parsed.markets) {
      return null;
    }
    return parsed;
  }

  private castRateResponse(data: unknown): RatesResponse | null {
    if (!data) {
      return null;
    }

    return data as RatesResponse;
  }

  start() {
    this.marketFetcher.startPolling();
  }

  stop() {
    this.marketFetcher.stopPolling();
    this.rateFetcher.stopPolling();
  }

  private handleMarketResponse(resp: MarketResponse) {
    this.pairs = {};

    if (this.rateFetcher.isPolling()) {
      this.rateFetcher.stopPolling();
    }

    const pairs: PairMap = {};
    for (const pair of resp.markets) {
      if (pair.status !== 'available') {
        continue;
      }
      pairs[pair.id] = pair;
    }

    this.pairs = pairs;
    this.rateFetcher.startPolling();
  }

  private handleRatesResponse(resp: RatesResponse) {
    const pairs = this.pairs;
    for (const [pairName, price] of Object.entries(resp)) {
      const pair = pairs[pairName];
      if (!pair) {
        continue;
      }
      const prices = resp[pairName];

      if (prices.bids.length) {
        this.dexHelper.cache.setex(
          this.dexKey,
          this.dexHelper.config.data.network,
          `${pair.base.address}_${pair.quote.address}_bids`,
          this.config.marketConfig.dataTTLS,
          JSON.stringify(prices.bids),
        );
      }

      if (prices.asks.length) {
        this.dexHelper.cache.setex(
          this.dexKey,
          this.dexHelper.config.data.network,
          `${pair.base.address}_${pair.quote.address}_asks`,
          this.config.marketConfig.dataTTLS,
          JSON.stringify(prices.asks),
        );
      }
    }
  }

  checkHealth(): boolean {
    return [this.marketFetcher, this.rateFetcher].some(
      f => f.lastFetchSucceeded,
    );
  }

  public async getOrderPrice(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
  ): Promise<PriceAndAmountBigNumber[] | null> {
    let reversed = false;

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

    let orderPrices = orderPricesAsString.map(price => {
      return {
        amount: new BigNumber(price.amount),
        price: new BigNumber(price.price),
      } as PriceAndAmountBigNumber;
    });

    if (reversed) {
      orderPrices = orderPrices.map(reversePrice);
    }

    return orderPrices;
  }

  private async getPayload(
    srcToken: Token,
    destToken: Token,
    amount: string,
    side: SwapSide,
    txOrigin: Address,
  ) {
    let orderPrices: PriceAndAmountBigNumber[] | null = null;
    try {
      orderPrices = await this.getOrderPrice(srcToken, destToken, side);
      if (!orderPrices) {
        return {
          value: BN_0,
        };
      }
    } catch (e) {
      this.logger.error(e);
      return { error: e };
    }
    if (!orderPrices) {
      return null;
    }

    const payload: RFQPayload = {
      makerAsset: srcToken.address,
      takerAsset: destToken.address,
      model: 'firm',
      makerAmount: side === SwapSide.BUY ? amount : undefined,
      takerAmount: side === SwapSide.SELL ? amount : undefined,
      taker: this.augustusAddress,
      txOrigin,
    };

    return {
      payload,
    };
  }

  async getFirmRate(
    _srcToken: Token,
    _destToken: Token,
    srcAmount: string,
    side: SwapSide,
    txOrigin: Address,
  ): Promise<OrderInfo> {
    const srcToken = this.dexHelper.config.wrapETH(_srcToken);
    const destToken = this.dexHelper.config.wrapETH(_destToken);

    if (BigInt(srcAmount) === 0n) {
      throw new Error('getFirmRate failed with srcAmount == 0');
    }

    const result = await this.getPayload(
      srcToken,
      destToken,
      srcAmount,
      side,
      txOrigin,
    );

    if (!result) {
      this.logger.error(`getPayload failed with empty payload`);
      throw new Error('getFirmRate failed with empty payload');
    }

    if (result.error) {
      this.logger.error(`getPayload failed with error: `, result.error);
      throw new Error('getFirmRate failed no payload');
    }

    if (!result.payload) {
      this.logger.error(`No payload ${JSON.stringify(result)}`);
      throw new Error('getFirmRate failed no payload');
    }

    try {
      const { data } =
        await this.dexHelper.httpRequest.request<RFQFirmRateResponse>({
          data: result.payload,
          ...this.config.firmRateConfig,
        });

      if (data.status === 'rejected') {
        this.logger.warn(
          `getFirmRate failed ${JSON.stringify(
            result,
          )}, result:${JSON.stringify(data)}`,
        );
        throw new Error('getFirmRate rejected');
      }

      return {
        order: {
          maker: data.order.maker,
          taker: data.order.taker,
          expiry: data.order.expiry,
          nonceAndMeta: data.order.nonceAndMeta,
          makerAsset: data.order.makerAsset,
          takerAsset: data.order.takerAsset,
          makerAmount: data.order.makerAmount,
          takerAmount: data.order.takerAmount,
        },
        signature: data.order.signature,
        takerTokenFillAmount: data.order.takerAmount,
        permitMakerAsset: '0x',
        permitTakerAsset: '0x',
      };
    } catch (e) {
      this.logger.error(e);
      throw e;
    }
  }
}
