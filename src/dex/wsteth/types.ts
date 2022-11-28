import { Address } from '../../types';

export type PoolState = {
  totalPooledEther: bigint;
  totalShares: bigint;
};

export type WstETHData = {};

export type DexParams = {
  wstETHAddress: Address;
  stETHAddress: Address;
};
