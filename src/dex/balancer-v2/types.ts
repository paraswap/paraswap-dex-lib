import { Address } from '../../types';

export type TokenState = {
  balance: bigint;
  scalingFactor?: bigint; // It includes the token priceRate
  weight?: bigint;
};

export type PoolState = {
  tokens: {
    [address: string]: TokenState;
  };
  swapFee: bigint;
  amp?: bigint;
  // Linear Pools
  mainIndex?: number;
  wrappedIndex?: number;
  bptIndex?: number;
  lowerTarget?: bigint;
  upperTarget?: bigint;
};

export type SubgraphToken = {
  address: string;
  decimals: number;
};

export interface SubgraphPoolBase {
  id: string;
  address: string;
  poolType: string;
  tokens: SubgraphToken[];
  mainIndex: number;
  wrappedIndex: number;
}

export type BalancerSwapV2 = {
  poolId: string;
  amount: string;
};

export type OptimizedBalancerV2Data = {
  swaps: BalancerSwapV2[];
};

export type BalancerFunds = {
  sender: string;
  recipient: string;
  fromInternalBalance: boolean;
  toInternalBalance: boolean;
};

// Indexes represent the index of the asset assets array param
export type BalancerSwap = {
  poolId: string;
  assetInIndex: number;
  assetOutIndex: number;
  amount: string;
  userData: string;
};

export enum SwapTypes {
  SwapExactIn,
  SwapExactOut,
}

export type BalancerParam = [
  kind: SwapTypes,
  swaps: BalancerSwap[],
  assets: string[],
  funds: BalancerFunds,
  limits: string[],
  deadline: string,
];

export type BalancerV2Data = {
  poolId: string;
};

export type DexParams = {
  subgraphURL: string;
  vaultAddress: Address;
};

export interface callData {
  target: string;
  callData: string;
}
export type PoolStateMap = { [address: string]: PoolState };

export interface PoolStateCache {
  blockNumber: number;
  poolState: PoolStateMap;
}
