import { Address } from '@paraswap/core';

export type PoolState = {
  tokenPrice: bigint;
};

export type DexParams = {
  fromBlock: number;
  lendingGasCost: number;
  factoryAddress: Address;
};

export type IdleToken = {
  idleSymbol: string;
  idleAddress: string;
  cdoAddress: string;
  tokenType: 'AA' | 'BB';
  blockNumber: number;
  address: string;
  decimals: number;
};

export type TrancheToken = {
  idleAddress: IdleToken['idleAddress'];
  cdoAddress: IdleToken['cdoAddress'];
  tokenType: IdleToken['tokenType'];
};

export type IdleDaoData = {
  idleToken: IdleToken;
  fromIdleToken: boolean;
};

export type Deposit = [amount: string, referral?: string];

export type Withdraw = [amount: string];

export type Param = Deposit | Withdraw;

export enum PoolFunctions {
  withdrawAA = 'withdrawAA',
  depositAA = 'depositAARef',
  withdrawBB = 'withdrawBB',
  depositBB = 'depositBBRef',
}
