import { Address } from '../../types';

// Immutable data types available on all pools (Available from API)
export type CommonImmutablePoolState = {
  address: string;
  poolType: string;
  tokens: string[];
  weights: bigint[];
  // TODO re-introduce this once added to API
  // scalingFactors: bigint[];
  hookType: string | undefined;
};

// Mutable data types available on all pools (Available via onchain calls/events)
export interface CommonMutableState {
  tokenRates: bigint[];
  balancesLiveScaled18: bigint[];
  swapFee: bigint;
  aggregateSwapFee: bigint;
  totalSupply: bigint;
  isPoolPaused: boolean;
  // TODO remove this once API provides it
  scalingFactors: bigint[];
  // TODO remove this once API provides it
  hasHook: boolean;
}

type CommonPoolState = CommonImmutablePoolState & CommonMutableState;

export type PoolState =
  | CommonPoolState
  | (CommonPoolState & StableMutableState);

// Stable Pool specific mutable data
export interface StableMutableState {
  amp: bigint;
}

export type PoolStateMap = {
  [address: string]: PoolState;
};

export type ImmutablePoolStateMap = {
  [address: string]: CommonImmutablePoolState;
};

export type BalancerV3Data = {
  // TODO: BalancerV3Data is the dex data that is
  // returned by the API that can be used for
  // tx building. The data structure should be minimal.
  // Complete me!
  exchange: Address;
};

export type DexParams = {
  // Used to map network > API Name, e.g. 11155111>SEPOLIA
  apiNetworkName: string;
  vaultAddress: string;
};
