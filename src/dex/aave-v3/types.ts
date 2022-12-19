import { Address } from '@paraswap/core';

export type Data = {
  fromAToken: boolean;
  isV3: boolean;
};

export type DepositETHParams = [
  pool: string,
  onBehalfOf: string,
  referralCode: number,
];

export type WithdrawETHParams = [pool: string, amount: string, to: string];

export type Supply = [
  asset: string,
  amount: string,
  onBehalfOf: string,
  referralCode: number,
];

export type Withdraw = [asset: string, amount: string, to: string];

export type Param = DepositETHParams | WithdrawETHParams | Supply | Withdraw;

export enum PoolAndWethFunctions {
  withdraw = 'withdraw',
  withdrawETH = 'withdrawETH',
  supply = 'supply',
  depositETH = 'depositETH',
}

export type DexParam = {
  ethGasCost: number;
  lendingGasCost: number;
  poolAddress: Address;
  wethGatewayAddress: Address;
};
