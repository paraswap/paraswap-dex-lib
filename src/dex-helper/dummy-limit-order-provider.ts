import { ILimitOrderProvider } from './ilimit-order-provider';
import {
  ParaswapLimitOrderResponse,
  ParaswapPriceSummaryResponse,
} from '../dex/paraswap-limit-orders/types';
import { SwapSide, Network, LIMIT_ORDER_PROVIDERS } from '../constants';
import { Address, BigIntAsString } from '../types';

export class DummyLimitOrderProvider
  implements
    ILimitOrderProvider<
      ParaswapLimitOrderResponse,
      ParaswapPriceSummaryResponse
    >
{
  readonly name: LIMIT_ORDER_PROVIDERS = LIMIT_ORDER_PROVIDERS.PARASWAP;

  private readonly _priceSummary: {
    [key in string]: ParaswapPriceSummaryResponse[];
  } = {};

  private readonly _ordersToExecute: {
    [key in number]: ParaswapLimitOrderResponse[];
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
  ): Promise<ParaswapLimitOrderResponse[] | null> {
    return this._ordersToExecute[network]
      ? this._ordersToExecute[network]
      : null;
  }

  async fetchPriceSummary(
    network: Network,
    src: Address,
    dest: Address,
  ): Promise<ParaswapPriceSummaryResponse[] | null> {
    const key = DummyLimitOrderProvider.getPriceSummaryCacheKey(
      network,
      src,
      dest,
    );
    const priceSummary = this._priceSummary[key];
    return priceSummary === undefined ? null : priceSummary;
  }

  setPriceSummary(
    network: Network,
    src: Address,
    dest: Address,
    priceSummary: ParaswapPriceSummaryResponse[],
  ) {
    const key = DummyLimitOrderProvider.getPriceSummaryCacheKey(
      network,
      src,
      dest,
    );
    this._priceSummary[key] = priceSummary;
  }

  setOrdersToExecute(network: number, orders: ParaswapLimitOrderResponse[]) {
    this._ordersToExecute[network] = orders;
  }

  static getPriceSummaryCacheKey(
    network: Network,
    src: Address,
    dest: Address,
  ) {
    return `${network}_${dest.toLowerCase()}_${src.toLowerCase()}`;
  }
}
