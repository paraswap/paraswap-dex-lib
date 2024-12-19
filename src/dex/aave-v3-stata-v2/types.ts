import { Address } from '../../types';

export type PoolState = {};

export enum TokenType {
  UNDERLYING,
  A_TOKEN,
  STATA_TOKEN,
  UNKNOWN,
}

export type AaveV3StataV2Data = {
  exchange: Address;
  srcType: TokenType;
  destType: TokenType;
};

export type DexParams = {
  factoryAddresses: string[];
  pool: string;
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
  deposit = 'deposit',
  depositATokens = 'depositATokens',
  redeem = 'redeem',
  redeemATokens = 'redeemATokens',
  mint = 'mint',
  withdraw = 'withdraw',
}

export enum Rounding {
  UP = 'UP',
  DOWN = 'DOWN',
}
