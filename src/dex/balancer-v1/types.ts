import { Address, NumberAsString } from '../../types';

export type FractionAsString = string;

export type TokenInfo = {
  address: Address;
  balance: FractionAsString;
  decimals: number;
  denormWeight: FractionAsString;
};

export type PoolInfo = {
  id: Address;
  swapFee: FractionAsString;
  totalWeight: FractionAsString;
  tokens: TokenInfo[];
  tokensList: Address[];
};

// This is format that comes from pools list URL (could also come from subgraph)
export type PoolsInfo = {
  pools: PoolInfo[];
};

export type PoolState = {
  // TODO: poolState is the state of event
  // subscriber. This should be the minimum
  // set of parameters required to compute
  // pool prices. Complete me!
  tokenBalances: { [tokenAddress: string]: bigint };
};

export type BalancerSwap = {
  pool: Address;
  tokenInParam: NumberAsString;
  tokenOutParam: NumberAsString;
  maxPrice: NumberAsString;
};

export type BalancerV1Data = {
  // TODO: BalancerV1Data is the dex data that is
  // returned by the API that can be used for
  // tx building. The data structure should be minimal.
  // Complete me!
  poolId: Address;
};

export type OptimizedBalancerV1Data = {
  swaps: BalancerSwap[];
};

export type DexParams = {
  // TODO: DexParams is set of parameters the can
  // be used to initiate a DEX fork.
  // Complete me!
  poolsURL: string;
  subgraphURL: string;
  exchangeProxy: Address;
  multicallAddress: Address;
};

type BalancerBatchEthInSwapExactInParam = [
  swaps: BalancerSwap[],
  destToken: Address,
  destAmount: NumberAsString,
];
type BalancerBatchEthOutSwapExactInParam = [
  swaps: BalancerSwap[],
  srcToken: Address,
  srcAmount: NumberAsString,
  destAmount: NumberAsString,
];
type BalancerBatchSwapExactInParam = [
  swaps: BalancerSwap[],
  srcToken: Address,
  destToken: Address,
  srcAmount: NumberAsString,
  destAmount: NumberAsString,
];
type BalancerBatchEthInSwapExactOutParam = [
  swaps: BalancerSwap[],
  destToken: Address,
];
type BalancerBatchEthOutSwapExactOutParam = [
  swaps: BalancerSwap[],
  srcToken: Address,
  maxTotalAmountIn: NumberAsString,
];
type BalancerBatchSwapExactOutParam = [
  swaps: BalancerSwap[],
  srcToken: Address,
  destToken: Address,
  maxTotalAmountIn: NumberAsString,
];

export type BalancerParam =
  | BalancerBatchEthInSwapExactInParam
  | BalancerBatchEthOutSwapExactInParam
  | BalancerBatchSwapExactInParam
  | BalancerBatchEthInSwapExactOutParam
  | BalancerBatchEthOutSwapExactOutParam
  | BalancerBatchSwapExactOutParam;

export enum BalancerFunctions {
  batchEthInSwapExactIn = 'batchEthInSwapExactIn',
  batchEthOutSwapExactIn = 'batchEthOutSwapExactIn',
  batchSwapExactIn = 'batchSwapExactIn',
  batchEthInSwapExactOut = 'batchEthInSwapExactOut',
  batchEthOutSwapExactOut = 'batchEthOutSwapExactOut',
  batchSwapExactOut = 'batchSwapExactOut',
}
