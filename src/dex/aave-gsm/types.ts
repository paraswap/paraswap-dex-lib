import { Address, Token } from '../../types';

export type PoolState = {
  // TODO: poolState is the state of event
  // subscriber. This should be the minimum
  // set of parameters required to compute
  // pool prices. Complete me!
  canSwap: boolean;
  isFrozen: boolean;
  isSeized: boolean;
  accruedFees: bigint;
  availableUnderlyingLiquidity: bigint;
  availableUnderlyingExposure: bigint;
  exposureCapUnderlying: bigint;
};

// TODO: Define appropriate pool config types
export type PoolConfig = {
  underlying: Token;
  gsmAddress: Address;
  identifier: string; // bytes32 of pool identifier (Eg. bytes32("PSM-USDC-A"))
};

export type AaveGsmData = {
  // TODO: AaveGsmData is the dex data that is
  // returned by the API that can be used for
  // tx building. The data structure should be minimal.
  // Complete me!
  exchange: Address;
  assetAmount: bigint;
};

// TODO: Make these types match what we need for Aave GSM
export type DexParams = {
  gho: Token;
  pools: PoolConfig[];
};
