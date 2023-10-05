import { Address } from '../../types';

export type VerifiedData = {
  exchange: string;
};

export type DexParams = {
  vaultAddress: Address;
  subGraphUrl: string;
};

export type PoolStateMap = { [address: string]: PoolState };

export interface PoolStateCache {
  blockNumber: number;
  poolState: PoolStateMap;
}

// These should match the Verified Pool types available on Subgraph
export enum VerifiedPoolTypes {
  PrimaryIssuePool = 'PrimaryIssue',
  SecondaryIssuePool = 'SecondaryIssue',
}

export type TokenState = {
  balance: bigint;
};

export type PoolState = {
  tokens: {
    [address: string]: TokenState;
  };
  swapFee: bigint;
  orderedTokens: string[];
  //both Primary and Secondary issue Pools
  minimumOrderSize: bigint;
  //Primary issue pools
  minimumPrice?: bigint;
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
}

export type SubgraphPoolAddressDictionary = {
  [address: string]: SubgraphPoolBase;
};

export type OrdersState = {
  id: string;
  creator: Address;
  tokenIn: { id: Address };
  tokenOut: { id: Address };
  amountOffered: number;
  priceOffered: number;
  timestamp: bigint;
  orderReference: string;
};

export type SecondaryTradeState = {
  id: string;
  party: { id: Address };
  counterparty: { id: Address };
  orderType: string;
  price: number;
  currency: { id: Address };
  amount: number;
  executionDate: bigint;
  orderReference: string;
};

export interface SubgraphPoolBase {
  id: string;
  address: string;
  poolType: VerifiedPoolTypes;
  tokens: SubgraphToken[];
  security: Address; //to get primary maintokens for now new logic will be added
  currency: Address; //to get secondary maintokens for now new logic will be added
  orders?: OrdersState[]; //secondary pool swap logic
  secondaryTrades?: SecondaryTradeState[]; //secondary pool swap logic
  tokensMap: { [tokenAddress: string]: SubgraphToken };
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

export interface callData {
  target: string;
  callData: string;
}

export interface PoolStateCache {
  blockNumber: number;
  poolState: PoolStateMap;
}

export type PoolPairData = {
  tokens: string[];
  balances: bigint[];
  decimals: number[];
  scalingFactors: bigint[];
  indexIn: number;
  indexOut: number;
  bptIndex: number;
  swapFee: bigint;
  minOrderSize: bigint;
  minPrice?: bigint;
  orders?: OrdersState[];
  secondaryTrades?: SecondaryTradeState[];
};
