import BigNumber from 'bignumber.js';
import { SwapSide } from 'paraswap-core';
import { BN_0, BN_1, getBigNumberPow } from '../../bignumber-constants';
import { IDexHelper } from '../../dex-helper';
import Fetcher from '../../lib/fetcher/fetcher';
import { Logger, Address, Token } from '../../types';
import { OrderInfo } from '../paraswap-limit-orders/types';
import {
  BigNumberRate,
  BigNumberRates,
  MarketResponse,
  OrderPriceInfo,
  PairMap,
  PriceAndAmount,
  PriceAndAmountBigNumber,
  Rates,
  RatesResponse,
  RFQConfig,
  RFQFirmRateResponse,
  RFQPayload,
} from './types';

export const FIRM_RATE_TIMEOUT_MS = 500;

function onlyUnique(value: string, index: number, self: string[]) {
  return self.indexOf(value) === index;
}

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
    (this.augustusAddress =
      dexHelper.config.data.augustusAddress.toLowerCase()),
      (this.marketFetcher = new Fetcher<MarketResponse>(
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
      ));

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

    const tokensAddress: string[] = [];
    const pairsFullName: string[] = [];
    const pairs: PairMap = {};
    for (const pair of resp.markets) {
      if (pair.status !== 'available') {
        continue;
      }
      pairs[pair.id] = {
        ...pair,
      };
      tokensAddress.push(pair.base.address);
      tokensAddress.push(pair.quote.address);

      const fullName = `${pair.quote.address}_${pair.base.address}`;
      const reversedFullName = `${pair.base.address}_${pair.quote.address}`;
      const reversedId = pair.id.split('-').reverse().join('-');
      const reversedPair = {
        id: reversedId,
        fullName: fullName,
        base: pair.quote,
        quote: pair.base,
        status: pair.status,
      };

      pairs[reversedId] = reversedPair;

      pairsFullName.push(fullName);
      pairsFullName.push(reversedFullName);
    }

    this.dexHelper.cache.setex(
      this.dexKey,
      this.dexHelper.config.data.network,
      'tokens',
      this.config.marketConfig.dataTTLS,
      JSON.stringify(tokensAddress.filter(onlyUnique)),
    );

    this.dexHelper.cache.setex(
      this.dexKey,
      this.dexHelper.config.data.network,
      'pairs',
      this.config.marketConfig.dataTTLS,
      JSON.stringify(pairsFullName.filter(onlyUnique)),
    );

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
          `${pair.base.address}_${pair.quote.address}_${SwapSide.SELL}`,
          this.config.marketConfig.dataTTLS,
          JSON.stringify(prices.bids),
        );
      }

      if (prices.asks.length) {
        this.dexHelper.cache.setex(
          this.dexKey,
          this.dexHelper.config.data.network,
          `${pair.base.address}_${pair.quote.address}_${SwapSide.BUY}`,
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
  ): Promise<OrderPriceInfo | null> {
    // let from = side === SwapSide.SELL ? srcToken : destToken;
    // let to = side === SwapSide.SELL ? destToken : srcToken;

    let pricesAsString: string | null = await this.dexHelper.cache.get(
      this.dexKey,
      this.dexHelper.config.data.network,
      `${srcToken.address}_${destToken.address}_${side}`,
    );
    let reversed = false;
    if (!pricesAsString) {
      side = side === SwapSide.SELL ? SwapSide.BUY : SwapSide.SELL;
      [srcToken, destToken] = [destToken, srcToken];
      pricesAsString = await this.dexHelper.cache.get(
        this.dexKey,
        this.dexHelper.config.data.network,
        `${srcToken.address}_${destToken.address}_${side}`,
      );

      reversed = true;
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

    return {
      reversed,
      from: srcToken,
      to: destToken,
      side,
      rates: orderPrices,
    };
  }

  private async getPayload(
    srcToken: Token,
    destToken: Token,
    srcAmount: string,
    side: SwapSide,
    txOrigin: Address,
  ) {
    let orderPrices: OrderPriceInfo | null = null;
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

    let _side = orderPrices.reversed ? SwapSide.SELL : SwapSide.BUY;
    if (side === SwapSide.BUY) {
      _side = orderPrices.reversed ? SwapSide.BUY : SwapSide.SELL;
    }

    const amount = new BigNumber(srcAmount).div(
      getBigNumberPow(
        (_side === SwapSide.SELL ? srcToken : destToken).decimals,
      ),
    );

    let makerAsset = srcToken.address;
    let takerAsset = destToken.address;

    if (orderPrices.reversed || SwapSide.BUY) {
      makerAsset = destToken.address;
      takerAsset = srcToken.address;
    }

    const payload: RFQPayload = {
      makerAsset,
      takerAsset,
      model: 'firm',
      side,
      takerAmount: amount.toFixed(),
      taker: this.augustusAddress,
      txOrigin,
    };

    return { payload, value: amount };
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

    if (result.value?.isZero()) {
      throw new Error(
        `Empty value. payload: ${JSON.stringify(result.payload)}.`,
      );
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
