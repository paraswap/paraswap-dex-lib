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
  ampIsUpdating: boolean;
  ampStartValue: bigint;
  ampEndValue: bigint;
  ampStartTime: bigint;
  ampStopTime: bigint;
}

export type PoolStateMap = {
  [address: string]: PoolState;
};

export type ImmutablePoolStateMap = {
  [address: string]: CommonImmutablePoolState;
};

export type BalancerV3Data = {
  poolAddress: string;
};

export type DexParams = {
  // Used to map network > API Name, e.g. 11155111>SEPOLIA
  apiNetworkName: string;
  vaultAddress: string;
  // This router handles single swaps
  // https://github.com/balancer/balancer-v3-monorepo/blob/main/pkg/interfaces/contracts/vault/IRouter.sol
  balancerRouterAddress: string;
};
