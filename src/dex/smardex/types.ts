import { Address } from '../../types';
import {
  UniswapV2Data,
  UniswapV2PoolOrderedParams,
  DexParams as UniswapV2DexParams,
  UniswapPool,
} from '../uniswap-v2/types';
import { UniswapV2Pair } from '../uniswap-v2/uniswap-v2';
import { SmardexEventPool } from './smardex';

export interface SmardexPoolState {
  reserves0: string;
  reserves1: string;
  fictiveReserves0: string;
  fictiveReserves1: string;
  priceAverage0: string;
  priceAverage1: string;
  feeCode: number;
}

export interface SmardexData extends UniswapV2Data {
  deadline: number;
  receiver: Address;
}

export enum SmardexRouterFunctions {
  sellExactEth = 'swapExactETHForTokens',
  sellExactToken = 'swapExactTokensForETH',
  swapExactIn = 'swapExactTokensForTokens',
  buyExactEth = 'swapTokensForExactETH',
  buyExactToken = 'swapETHForExactTokens',
  swapExactOut = 'swapTokensForExactTokens',
}

export type DexParams = UniswapV2DexParams;

export interface SmardexPoolOrderedParams extends UniswapV2PoolOrderedParams {
  fictiveReservesIn: string;
  fictiveReservesOut: string;
  priceAverageIn: string;
  priceAverageOut: string;
}

export interface SmardexPair extends Omit<UniswapV2Pair, 'pool'> {
  pool?: SmardexEventPool;
}

export type SmardexPool = UniswapPool;
