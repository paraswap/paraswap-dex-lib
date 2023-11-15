import { Address } from '../../types';

export type PoolState = {
  totalPooledEther: bigint;
  totalShares: bigint;
};

export type ClaystackData = {};

export type DexParams = {
  csETH: Address;
  clayMain: Address;
};
