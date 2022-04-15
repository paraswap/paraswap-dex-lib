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

export type DepositWithdrawReturn = {
  opType: WethFunctions;
  callee: string;
  calldata: string;
  value: string;
};
export interface IWethDepositorWithdrawer {
  getDepositWithdrawParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    side: SwapSide,
  ): DepositWithdrawReturn | undefined;
}
