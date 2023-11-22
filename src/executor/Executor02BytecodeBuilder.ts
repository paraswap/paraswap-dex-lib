import { IExecutorBytecodeBuilder } from './IExecutorBytecodeBuilder';
import { OptimalRate } from '@paraswap/core';
import { DexExchangeParam } from '../types';
import { DepositWithdrawReturn } from '../dex/weth/types';
import { IDexHelper } from '../dex-helper';

/**
 * Future class to build bytecode for Executor02
 */
export class Executor02BytecodeBuilder implements IExecutorBytecodeBuilder {
  constructor(dexHelper: IDexHelper) {}

  buildByteCode(
    priceRoute: OptimalRate,
    exchangeDataList: DexExchangeParam[],
    maybeWethCallData?: DepositWithdrawReturn,
  ): string {
    return '';
  }
}
