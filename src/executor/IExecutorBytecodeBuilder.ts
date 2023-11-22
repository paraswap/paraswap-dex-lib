import { OptimalRate } from '@paraswap/core';
import { DexExchangeParam } from '../types';
import { DepositWithdrawReturn } from '../dex/weth/types';

export interface IExecutorBytecodeBuilder {
  buildByteCode(
    priceRoute: OptimalRate,
    exchangeDataList: DexExchangeParam[],
    maybeWethCallData?: DepositWithdrawReturn,
  ): string;
}
