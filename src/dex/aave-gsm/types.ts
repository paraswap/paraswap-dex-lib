import { Address, Token } from '../../types';

export type PoolState = {
  canSwap: boolean; // TODO: Remove and use below
  isFrozen: boolean;
  isSeized: boolean;
  accruedFees: bigint;
  // TODO: Consider renaming the below
  availableUnderlyingLiquidity: bigint;
  availableUnderlyingExposure: bigint;
  exposureCapUnderlying: bigint;
};

export type PoolConfig = {
  underlying: Token;
  gsmAddress: Address;
  identifier: string; // bytes32 of pool identifier (Eg. bytes32("PSM-USDC-A"))
};

export type AaveGsmData = {
  exchange: Address;
  assetAmount: bigint;
};

export type DexParams = {
  gho: Token;
  pools: PoolConfig[];
};
