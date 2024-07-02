import { Address } from '@paraswap/core';
import { Contract } from 'web3-eth-contract';

export type DexParams = {
  lendingGasCost: number;
  factoryAddress: Address;
};

export type IdleToken = {
  idleDecimals: number;
  idleSymbol: string;
  idleAddress: string;
  cdoAddress: string;
  cdoContract?: Contract; // used to get virtualPrice
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
  idleToken: Pick<IdleToken, 'cdoAddress' | 'tokenType'>;
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
