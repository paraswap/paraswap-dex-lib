import { Address, NumberAsString } from '../../types';
import {
  UniswapV2Data,
  DexParams as UniswapV2DexParams,
  UniswapPool,
} from '../uniswap-v2/types';
import { UniswapV2Pair } from '../uniswap-v2/uniswap-v2';
import { type SmardexEventPool } from './smardex';

export interface SmardexPoolState {
  reserves0: string;
  reserves1: string;
  fictiveReserves0: string;
  fictiveReserves1: string;
  priceAverage0: string;
  priceAverage1: string;
  priceAverageLastTimestamp: number;
  feesLp: number;
  feesPool: number;
}

// export interface SmardexData extends UniswapV2Data {
export interface SmardexData extends Omit<UniswapV2Data, 'feeFactor'> {
  deadline: number;
  receiver: Address;
}

export type SellOnSmardexParam = [
  amountIn: NumberAsString,
  amountOutMin: NumberAsString,
  path: Address[],
  receiver: Address,
  deadline: number,
];

export type BuyOnSmardexParam = [
  amountIn: NumberAsString,
  amountOutMin: NumberAsString,
  path: Address[],
  receiver: Address,
  deadline: number,
];

export type SmardexParam = SellOnSmardexParam | BuyOnSmardexParam;

export type DexParams = Omit<UniswapV2DexParams, 'feeCode'>;

export interface SmardexPoolOrderedParams {
  fromToken: string;
  toToken: string;
  token0: string;
  token1: string;
  reserves0: bigint;
  reserves1: bigint;
  fictiveReserves0: bigint;
  fictiveReserves1: bigint;
  priceAverage0: bigint;
  priceAverage1: bigint;
  priceAverageLastTimestamp: number;
  exchange: string;
  feesLp: bigint;
  feesPool: bigint;
}

export interface SmardexPair extends Omit<UniswapV2Pair, 'pool'> {
  pool?: SmardexEventPool;
}

export type SmardexPool = UniswapPool;
