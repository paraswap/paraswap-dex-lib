import { Address } from '../../types';
import BigNumber from 'bignumber.js';

export interface Token {
  address: string;
  balance: BigNumber;
  decimals: number;
  denormWeight: BigNumber;
}

export type PoolState = {
  id: string;
  swapFee: BigNumber;
  totalWeight: BigNumber;
  tokens: Token[];
  tokensList: string[];
  publicSwap?: string;
};

export interface PoolStates {
  pools: PoolState[];
}

export type PoolStateMap = { [address: string]: PoolState };

export type BalancerSwaps = {
  pool: Address;
  tokenInParam: string;
  tokenOutParam: string;
  maxPrice: string;
}[];

export type BalancerV1Data = {
  exchangeProxy: Address;
  pool: Address;
};

export type OptimizedBalancerV1Data = {
  exchangeProxy: Address;
  swaps: BalancerSwaps;
};

export type DexParams = {
  subgraphURL: string;
};

type BalancerBatchEthInSwapExactInParam = [
  swaps: BalancerSwaps,
  destToken: string,
  destAmount: string,
];
type BalancerBatchEthOutSwapExactInParam = [
  swaps: BalancerSwaps,
  srcToken: string,
  srcAmount: string,
  destAmount: string,
];
type BalancerBatchSwapExactInParam = [
  swaps: BalancerSwaps,
  srcToken: string,
  destToken: string,
  srcAmount: string,
  destAmount: string,
];
type BalancerBatchEthInSwapExactOutParam = [
  swaps: BalancerSwaps,
  destToken: string,
];
type BalancerBatchEthOutSwapExactOutParam = [
  swaps: BalancerSwaps,
  srcToken: string,
  maxTotalAmountIn: string,
];
type BalancerBatchSwapExactOutParam = [
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
