import { NumberAsString, SwapSide } from 'paraswap-core';
import { Address } from '../../types';

export type WethData = null;

export type DexParams = {
  poolGasCost: number;
};

export enum WethFunctions {
  withdrawAllWETH = 'withdrawAllWETH',
  deposit = 'deposit',
  withdraw = 'withdraw',
}

export type DepositWithdrawData = {
  callee: string;
  calldata: string;
  value: string;
};

export type DepositWithdrawReturn = {
  deposit?: DepositWithdrawData;
  withdraw?: DepositWithdrawData;
};

export interface IWethDepositorWithdrawer {
  getDepositWithdrawParam(
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    side: SwapSide,
  ): DepositWithdrawReturn;
}
