import { BigIntAsString, Address } from '../types';
import { LIMIT_ORDER_PROVIDERS, Network } from '../constants';
import { SwapSide } from 'paraswap-core';

export interface ILimitOrderProvider<
  LimitOrderResponse,
  LimitOrderPriceSummaryResponse,
> {
  name: LIMIT_ORDER_PROVIDERS;

  // null is for the case when some orders are not available after the lag
  // between requesting the prices and actually building the order
  fetchAndReserveOrders(
    network: Network,
    srcAddress: Address,
    destAddress: Address,
    srcAmount: BigIntAsString,
    destAmount: BigIntAsString,
    swapSide: SwapSide,
    userAddress: Address,
    backupOrdersMaxPercent?: number,
    backupOrdersMinCount?: number,
  ): Promise<LimitOrderResponse[] | null>;

  fetchPriceSummary(
    network: Network,
    src: Address,
    dest: Address,
  ): Promise<LimitOrderPriceSummaryResponse[] | null>;
}
