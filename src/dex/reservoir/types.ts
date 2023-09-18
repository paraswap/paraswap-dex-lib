import { Address, Token } from '../../types';
import { SwapSide } from '@paraswap/core';
import { UniswapV2PoolOrderedParams } from '../uniswap-v2/types';
import { ReservoirEventPool } from './reservoir-pool';

export enum ReservoirPoolTypes {
  ConstantProduct = 0,
  Stable = 1,
}

export enum ReservoirSwapFunctions {
  exactInput = 'swapExactForVariable',
  exactOutput = 'swapVariableForExact',
}

export interface ReservoirPair {
  token0: Token;
  token1: Token;
  curveId: ReservoirPoolTypes;
  exchange?: Address;
  pool?: ReservoirEventPool;
}

export type ReservoirPoolState = {
  reserve0: string;
  reserve1: string;
  curveId: ReservoirPoolTypes;
  swapFee: bigint;
  // only applicable for Stable pool, null for a constant product pool
  ampCoefficient: bigint | null;
};

export type ReservoirData = {
  router: Address;
  type: SwapSide;
  curveIds: ReservoirPoolTypes[];
  path: Address[];
};

export type DexParams = {
  subgraphURL?: string;
  factory: Address;
  router: Address;
};

export interface ReservoirOrderedParams extends UniswapV2PoolOrderedParams {
  stable: {
    decimalsIn: bigint;
    decimalsOut: bigint;
    ampCoefficient: bigint;
  } | null;
}
