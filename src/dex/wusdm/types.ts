import { Address } from '../../types';

export type PoolState = {
  totalShares: bigint;
  totalAssets: bigint;
};

export type WUSDMData = {};

export type DexParams = {
  wUSDMAddress: Address;
  USDMAddress: Address;
};
