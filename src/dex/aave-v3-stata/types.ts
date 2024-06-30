import { Address } from '../../types';

export type PoolState = {
  // TODO: poolState is the state of event
  // subscriber. This should be the minimum
  // set of parameters required to compute
  // pool prices. Complete me!
};

export enum TokenType {
  UNDERLYING,
  A_TOKEN,
  STATA_TOKEN,
  UNKNOWN,
}

export type AaveV3StataData = {
  // TODO: AaveV3StataData is the dex data that is
  // returned by the API that can be used for
  // tx building. The data structure should be minimal.
  // Complete me!
  exchange: Address;
  srcType: TokenType;
  destType: TokenType;
};

export type DexParams = {
  factoryAddress: string;
};

export type StataToken = {
  address: string;
  underlying: string;
  underlyingAToken: string;
  stataSymbol: string;
  decimals: number;
};

export type DepositParams = [
  // amount of assets to deposit
  assets: string,
  receiver: string,
  referralCode: number,
  // true if depositing the underlying, false if depositing the aToken
  depositToAave: boolean,
];

export type RedeemParams = [
  // amount of shares to redeem
  shares: string,
  receiver: string,
  owner: string,
  // true if redeeming the underlying, false if redeeming the aToken
  withdrawFromAave: string,
];

export type Param = DepositParams | RedeemParams;

export enum StataFunctions {
  deposit = 'deposit(uint256,address,uint16,bool)',
  redeem = 'redeem(uint256,address,address,bool)',
  mint = 'mint',
  withdraw = 'withdraw',
}

export enum Rounding {
  UP = 'UP',
  DOWN = 'DOWN',
}
