import { Address } from '../../types';

export type PoolState = {
  totalAssets: bigint;
  totalSupply: bigint;
  lastUpdate: bigint;
  rate: bigint;
  paused: boolean;
};

export type AngleStakedStableData = { exchange: Address };

export type DexParams = {
  stEUR: Address;
  agEUR: Address;
};
