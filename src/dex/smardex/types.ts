import { Address, NumberAsString } from '../../types';
import {
  UniswapV2Data,
  UniswapV2PoolOrderedParams,
  DexParams as UniswapV2DexParams,
  UniswapPool,
  UniswapDataLegacy,
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
  priceAverageLastTimestamp: number;
  feeCode: number;
}

// event Sync (uint256 reserve0, uint256 reserve1, uint256 fictiveReserve0, uint256 fictiveReserve1, uint256 priceAverage0, uint256 priceAverage1)
export enum TOPICS { SYNC_EVENT = '0x2a368c7f33bb86e2d999940a3989d849031aff29b750f67947e6b8e8c3d2ffd6' };

export interface SmardexData extends UniswapV2Data {
  deadline: number;
  receiver: Address;
}

// export type SmardexDataLegacy = UniswapDataLegacy;

export enum SmardexRouterFunctions {
  sellExactEth = 'swapExactETHForTokens',
  sellExactToken = 'swapExactTokensForETH',
  swapExactIn = 'swapExactTokensForTokens',
  buyExactEth = 'swapTokensForExactETH',
  buyExactToken = 'swapETHForExactTokens',
  swapExactOut = 'swapTokensForExactTokens',
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

export type DexParams = UniswapV2DexParams;

export interface SmardexPoolOrderedParams extends UniswapV2PoolOrderedParams {
  fictiveReservesIn: string;
  fictiveReservesOut: string;
  priceAverageIn: string;
  priceAverageOut: string;
  priceAverageLastTimestamp: number,
}

export interface SmardexPair extends Omit<UniswapV2Pair, 'pool'> {
  pool?: SmardexEventPool;
}

export type SmardexPool = UniswapPool;
