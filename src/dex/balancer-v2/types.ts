import { Address } from '../../types';

// These should match the Balancer Pool types available on Subgraph
export enum BalancerPoolTypes {
  Weighted = 'Weighted',
  Stable = 'Stable',
  MetaStable = 'MetaStable',
  LiquidityBootstrapping = 'LiquidityBootstrapping',
  Investment = 'Investment',
  StablePhantom = 'StablePhantom',
  ComposableStable = 'ComposableStable',
  Linear = 'Linear',
  AaveLinear = 'AaveLinear',
  ERC4626Linear = 'ERC4626Linear',
  BeefyLinear = 'BeefyLinear',
  GearboxLinear = 'GearboxLinear',
  MidasLinear = 'MidasLinear',
  ReaperLinear = 'ReaperLinear',
  SiloLinear = 'SiloLinear',
  TetuLinear = 'TetuLinear',
  YearnLinear = 'YearnLinear',
}

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
  orderedTokens: string[];
  rate?: bigint;
  amp?: bigint;
  // Linear Pools
  mainIndex?: number;
  wrappedIndex?: number;
  bptIndex?: number;
  lowerTarget?: bigint;
  upperTarget?: bigint;
  actualSupply?: bigint;
};

export type SubgraphToken = {
  address: string;
  decimals: number;
};

export interface SubgraphMainToken extends SubgraphToken {
  poolToken: SubgraphToken;
  pathToToken: {
    poolId: string;
    poolAddress: string;
    token: SubgraphToken;
  }[];
  //used to flag tokens that inside of a nested composable stable this way we can avoid paths
  //through pools where the tokenIn and tokenOut are inside a nested pool
  //ie MAI / bbaUSD, where tokenIn is DAI and tokenOut is USDC
  isDeeplyNested: boolean;
}

export type SubgraphPoolAddressDictionary = {
  [address: string]: SubgraphPoolBase;
};

export interface SubgraphPoolBase {
  id: string;
  address: string;
  poolType: BalancerPoolTypes;
  tokens: SubgraphToken[];
  tokensMap: { [tokenAddress: string]: SubgraphToken };
  mainIndex: number;
  wrappedIndex: number;

  mainTokens: SubgraphMainToken[];
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
