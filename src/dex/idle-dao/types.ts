import { Address } from '@paraswap/core';

export type PoolState = {
  // TODO: poolState is the state of event
  // subscriber. This should be the minimum
  // set of parameters required to compute
  // pool prices. Complete me!
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
  address: string;
  decimals: number;
};

export type TrancheToken = {
  idleAddress: IdleToken['idleAddress'];
  cdoAddress: IdleToken['cdoAddress'];
  tokenType: IdleToken['tokenType'];
};

export type IdleDaoData = {
  // TODO: IdleDaoData is the dex data that is
  // returned by the API that can be used for
  // tx building. The data structure should be minimal.
  // Complete me!
  idleToken: IdleToken;
  fromIdleToken: boolean;
};

export type Deposit = [amount: string, referral?: string];

export type Withdraw = [amount: string];

export type Param = Deposit | Withdraw;

export enum PoolFunctions {
  withdrawAA = 'withdrawAA',
  depositAA = 'depositAA',
  withdrawBB = 'withdrawBB',
  depositBB = 'depositBB',
}
