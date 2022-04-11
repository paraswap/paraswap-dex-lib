export type AaveV2Data = {
  fromAToken: boolean;
  isV2: boolean;
};

export type AaveV2DepositETHParams_MAINNET = [
  onBehalfOf: string,
  referralCode: number,
];

export type AaveV2DepositETHParams_POLYGON = [
  lendingPool: string,
  onBehalfOf: string,
  referralCode: number,
];
export type AaveV2WithdrawETHParams_MAINNET = [amount: string, to: string];
export type AaveV2WithdrawETHParams_POLYGON = [
  lendingPool: string,
  amount: string,
  to: string,
];
export type AaveV2Deposit = [
  asset: string,
  amount: string,
  onBehalfOf: string,
  referralCode: number,
];
export type AaveV2Withdraw = [asset: string, amount: string, to: string];

export type AaveV2Param =
  | AaveV2DepositETHParams_MAINNET
  | AaveV2DepositETHParams_POLYGON
  | AaveV2WithdrawETHParams_MAINNET
  | AaveV2WithdrawETHParams_POLYGON
  | AaveV2Deposit
  | AaveV2Withdraw;

export enum AaveV2PoolAndWethFunctions {
  withdraw = 'withdraw',
  withdrawETH = 'withdrawETH',
  deposit = 'deposit',
  depositETH = 'depositETH',
}
