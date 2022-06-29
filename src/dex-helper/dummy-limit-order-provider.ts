import { ILimitOrderProvider } from './ilimit-order-provider';
import {
  ParaSwapLimitOrderResponse,
  ParaSwapPriceSummaryResponse,
} from '../dex/paraswap-limit-orders/types';
import { SwapSide, Network, LIMIT_ORDER_PROVIDERS } from '../constants';
import { Address, BigIntAsString } from '../types';

export class DummyLimitOrderProvider
  implements
    ILimitOrderProvider<
      ParaSwapLimitOrderResponse,
      ParaSwapPriceSummaryResponse
    >
{
  readonly name: LIMIT_ORDER_PROVIDERS = LIMIT_ORDER_PROVIDERS.PARASWAP;

  private readonly _priceSummary: {
    [key in string]: ParaSwapPriceSummaryResponse[];
  } = {};

  private readonly _ordersToExecute: {
    [key in number]: ParaSwapLimitOrderResponse[];
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
  ): Promise<ParaSwapLimitOrderResponse[] | null> {
    return this._ordersToExecute[network]
      ? this._ordersToExecute[network]
      : null;
  }

  async fetchPriceSummary(
    network: Network,
    src: Address,
    dest: Address,
  ): Promise<ParaSwapPriceSummaryResponse[] | null> {
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
    priceSummary: ParaSwapPriceSummaryResponse[],
  ) {
    const key = DummyLimitOrderProvider.getPriceSummaryCacheKey(
      network,
      src,
      dest,
    );
    this._priceSummary[key] = priceSummary;
  }

  setOrdersToExecute(network: number, orders: ParaSwapLimitOrderResponse[]) {
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
