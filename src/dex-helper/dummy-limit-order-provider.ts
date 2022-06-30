import { ILimitOrderProvider } from './ilimit-order-provider';
import {
  ParaSwapOrderResponse,
  ParaSwapOrderBookResponse,
} from '../dex/paraswap-limit-orders/types';
import { SwapSide, Network, LIMIT_ORDER_PROVIDERS } from '../constants';
import { Address, BigIntAsString } from '../types';

export class DummyLimitOrderProvider
  implements
    ILimitOrderProvider<ParaSwapOrderResponse, ParaSwapOrderBookResponse>
{
  readonly name: LIMIT_ORDER_PROVIDERS = LIMIT_ORDER_PROVIDERS.PARASWAP;

  private readonly _orderBook: {
    [key in string]: ParaSwapOrderBookResponse[];
  } = {};

  private readonly _ordersToExecute: {
    [key in number]: ParaSwapOrderResponse[];
  } = {};

  async fetchAndReserveOrders(
    network: Network,
    srcAddress: Address,
    destAddress: Address,
    srcAmount: BigIntAsString,
    destAmount: BigIntAsString,
    swapSide: SwapSide,
    userAddress: Address,
    backupOrdersMaxPercent?: number,
    backupOrdersMinCount?: number,
  ): Promise<ParaSwapOrderResponse[] | null> {
    return this._ordersToExecute[network]
      ? this._ordersToExecute[network]
      : null;
  }

  async fetchOrderBook(
    network: Network,
    src: Address,
    dest: Address,
  ): Promise<ParaSwapOrderBookResponse[] | null> {
    const key = DummyLimitOrderProvider.getOrderBookCacheKey(
      network,
      src,
      dest,
    );
    const orderBook = this._orderBook[key];
    return orderBook === undefined ? null : orderBook;
  }

  setOrderBook(
    network: Network,
    src: Address,
    dest: Address,
    orderBook: ParaSwapOrderBookResponse[],
  ) {
    const key = DummyLimitOrderProvider.getOrderBookCacheKey(
      network,
      src,
      dest,
    );
    this._orderBook[key] = orderBook;
  }

  setOrdersToExecute(network: number, orders: ParaSwapOrderResponse[]) {
    this._ordersToExecute[network] = orders;
  }

  static getOrderBookCacheKey(
    network: Network,
    src: Address,
    dest: Address,
  ) {
    return `${network}_${dest.toLowerCase()}_${src.toLowerCase()}`;
  }
}
