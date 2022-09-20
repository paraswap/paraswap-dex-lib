import BigNumber from 'bignumber.js';
import { Address } from '../../types';

export interface Token {
  address: string;
  balance: BigNumber;
  decimals: number;
  denormWeight: BigNumber;
}

export interface TokenAsString {
  address: string;
  balance: string;
  decimals: number;
  denormWeight: string;
}

export type PoolStateAsString = {
  id: string;
  swapFee: string;
  totalWeight: string;
  tokens: TokenAsString[];
  tokensList: string[];
  publicSwap?: string;
};

export type MinimalPoolState = Pick<PoolStateAsString, 'tokens'>;

export interface PoolStatesAsString {
  pools: PoolStateAsString[];
}

export type BalancerSwap = {
  pool: Address;
  tokenInParam: string;
  tokenOutParam: string;
  maxPrice: string;
};

export type BalancerV1Data = {
  exchangeProxy: Address;
  poolId: Address;
};

export type OptimizedBalancerV1Data = {
  exchangeProxy: Address;
  swaps: BalancerSwap[];
};

export type DexParams = {
  subgraphURL: string;
};

type BalancerBatchEthInSwapExactInParam = [
  swaps: BalancerSwap[],
  destToken: string,
  destAmount: string,
];
type BalancerBatchEthOutSwapExactInParam = [
  swaps: BalancerSwap[],
  srcToken: string,
  srcAmount: string,
  destAmount: string,
];
type BalancerBatchSwapExactInParam = [
  swaps: BalancerSwap[],
  srcToken: string,
  destToken: string,
  srcAmount: string,
  destAmount: string,
];
type BalancerBatchEthInSwapExactOutParam = [
  swaps: BalancerSwap[],
  destToken: string,
];
type BalancerBatchEthOutSwapExactOutParam = [
  swaps: BalancerSwap[],
  srcToken: string,
  maxTotalAmountIn: string,
];
type BalancerBatchSwapExactOutParam = [
  swaps: BalancerSwap[],
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
