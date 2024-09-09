import { Address, NumberAsString, Token } from '../../types';

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
  assetAmounts: bigint[];
};

export type DexParams = {
  gho: Token;
  pools: PoolConfig[];
};

export type AaveGsmParams = [
  srcToken: Address,
  destToken: Address,
  fromAmount: NumberAsString,
  toAmount: NumberAsString,
  exchange: Address,
  metadata: string,
];

export type AaveGsmDirectPayload = [params: AaveGsmParams, permit: string];
