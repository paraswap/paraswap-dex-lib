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
const reversePrice = ([amount, p]: BigNumberRate) =>
  [amount.times(p), BN_1.dividedBy(p)] as BigNumberRate;

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
          handler: this.handleMarketResponse,
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
        handler: this.handleRatesResponse,
      },
      config.rateConfig.intervalMs,
      logger,
    );
  }

  private castMarketResponse(data: unknown): MarketResponse | null {
    if (!data || !(data as MarketResponse).markets) {
      return null;
    }

    return data as MarketResponse;
  }

  private castRateResponse(data: unknown): RatesResponse | null {
    if (!data) {
      return null;
    }

    return data as RatesResponse;
  }

  start() {
    this.marketFetcher.startPolling();
    this.rateFetcher.startPolling();
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
        fullName: `${pair.base.address}_${pair.quote.address}`,
      };
      tokensAddress.push(pair.base.address);
      tokensAddress.push(pair.quote.address);

      const reversedId = pair.id.split('-').reverse().join('-');
      const reversedPair = {
        id: reversedId,
        fullName: `${pair.quote.address}_${pair.base.address}`,
        base: pair.quote,
        quote: pair.base,
        status: pair.status,
      };

      pairs[reversedId] = reversedPair;

      pairsFullName.push(pair.fullName);
      pairsFullName.push(reversedPair.fullName);
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

      const buyPrices = price.buyAmounts.map((amount, i) => [
        amount,
        price.buyPrices[i],
      ]);
      const sellPrices = price.sellAmounts.map((amount, i) => [
        amount,
        price.sellPrices[i],
      ]);

      if (buyPrices.length) {
        this.dexHelper.cache.setex(
          this.dexKey,
          this.dexHelper.config.data.network,
          `${pair.base}_${pair.quote}_${SwapSide.SELL}`,
          this.config.marketConfig.dataTTLS,
          JSON.stringify(buyPrices),
        );
      }

      if (sellPrices.length) {
        this.dexHelper.cache.setex(
          this.dexKey,
          this.dexHelper.config.data.network,
          `${pair.fullName}_${SwapSide.BUY}`,
          this.config.marketConfig.dataTTLS,
          JSON.stringify(sellPrices),
        );
      }
    }
  }

  checkHealth(): boolean {
    return [this.marketFetcher, this.rateFetcher].some(
      f => f.lastFetchSucceded,
    );
  }

  public async getOrderPrice(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
  ): Promise<OrderPriceInfo | null> {
    let from = side === SwapSide.SELL ? srcToken : destToken;
    let to = side === SwapSide.SELL ? destToken : srcToken;

    let pricesAsString: string | null = await this.dexHelper.cache.get(
      this.dexKey,
      this.dexHelper.config.data.network,
      `${from.address}_${to.address}_${side}`,
    );
    let reversed = false;
    if (!pricesAsString) {
      side = side === SwapSide.SELL ? SwapSide.BUY : SwapSide.SELL;
      [from, to] = [to, from];
      pricesAsString = await this.dexHelper.cache.get(
        this.dexKey,
        this.dexHelper.config.data.network,
        `${from.address}_${to.address}_${side}`,
      );
      reversed = true;
    }

    if (!pricesAsString) {
      return null;
    }

    const orderPricesAsString: Rates = JSON.parse(pricesAsString);
    if (!orderPricesAsString) {
      return null;
    }

    let orderPrices: BigNumberRates = orderPricesAsString.map(
      ([amount, price]) => [new BigNumber(amount), new BigNumber(price)],
    );

    if (reversed) {
      orderPrices = orderPrices.map(reversePrice);
    }

    return {
      reversed,
      from,
      to,
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

    let _side = orderPrices.reversed ? 'sell' : 'buy';
    if (side === SwapSide.BUY) {
      _side = orderPrices.reversed ? 'buy' : 'sell';
    }

    const amount = new BigNumber(srcAmount).div(
      getBigNumberPow(
        (_side === SwapSide.SELL ? srcToken : destToken).decimals,
      ),
    );

    let obj: {
      makerAmount?: string;
      takerAmount?: string;
    } = {};

    if (orderPrices.reversed) {
      if (_side === SwapSide.SELL) {
        obj = { takerAmount: amount.toFixed() };
      } else {
        obj = { makerAmount: amount.toFixed() };
      }
    } else {
      if (_side === SwapSide.SELL) {
        obj = { makerAmount: amount.toFixed() };
      } else {
        obj = { takerAmount: amount.toFixed() };
      }
    }

    const payload: RFQPayload = {
      makerAsset: orderPrices.from.address,
      takerAsset: orderPrices.to.address,
      model: 'firm',
      side,
      ...obj,
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

      return data.order;
    } catch (e) {
      this.logger.error(e);
      throw e;
    }
  }
}
