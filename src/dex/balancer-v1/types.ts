import { Address } from '../../types';
import BigNumber from 'bignumber.js';

export interface Token {
  address: string;
  balance: BigNumber;
  decimals: number;
  denomWeight: BigNumber;
}

export interface Pool {
  id: string;
  swapFee: BigNumber;
  totalWeight: BigNumber;
  tokens: Token[];
  tokensList: string[];
}

export type PoolState = {
  [address: string]: Pool;
};

export type BalancerV1Data = {
  pool: Address;
  exchangeProxy: Address;
};

export type DexParams = {
  subgraphURL: string;
};
