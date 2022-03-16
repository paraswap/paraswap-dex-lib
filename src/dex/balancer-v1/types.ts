import { Address } from '../../types';

export type BalancerSwaps = {
  pool: Address;
  tokenInParam: string;
  tokenOutParam: string;
  maxPrice: string;
}[];

export type BalancerData = {
  pool: Address;
  exchangeProxy: Address;
};

export type OptimizedBalancerData = {
  exchangeProxy: Address;
  swaps: BalancerSwaps;
};

export type BalancerBatchEthInSwapExactInParam = [
  swaps: BalancerSwaps,
  destToken: string,
  destAmount: string,
];

export type BalancerBatchEthOutSwapExactInParam = [
  swaps: BalancerSwaps,
  srcToken: string,
  srcAmount: string,
  destAmount: string,
];

export type BalancerBatchSwapExactInParam = [
  swaps: BalancerSwaps,
  srcToken: string,
  destToken: string,
  srcAmount: string,
  destAmount: string,
];

export type BalancerBatchEthInSwapExactOutParam = [
  swaps: BalancerSwaps,
  destToken: string,
];

export type BalancerBatchEthOutSwapExactOutParam = [
  swaps: BalancerSwaps,
  srcToken: string,
  maxTotalAmountIn: string,
];

export type BalancerBatchSwapExactOutParam = [
  swaps: BalancerSwaps,
  srcToken: string,
  destToken: string,
  maxTotalAmountIn: string,
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

export type DexParams = {
  subgraphURL: string;
};
