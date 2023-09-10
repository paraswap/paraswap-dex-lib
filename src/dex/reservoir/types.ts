import { Address } from '../../types';
import { SwapSide } from '@paraswap/core';
import { UniswapV2PoolOrderedParams } from '../uniswap-v2/types';

export enum ReservoirPoolTypes {
  ConstantProduct = 0,
  Stable = 1,
}

export enum ReservoirSwapFunctions {
  exactInput = 'swapExactForVariable',
  exactOutput = 'swapVariableForExact',
}

export type ReservoirPoolState = {
  // TODO: poolState is the state of event
  // subscriber. This should be the minimum
  // set of parameters required to compute
  // pool prices. Complete me!
  reserve0: string;
  reserve1: string;
  curveId: ReservoirPoolTypes;
  swapFee: bigint;
  // only applicable for Stable pool, null for a constant product pool
  ampCoefficient: bigint | null;
};

export type ReservoirData = {
  // TODO: ReservoirFinanceData is the dex data that is
  // returned by the API that can be used for
  // tx building. The data structure should be minimal.
  router: Address;
  // denominated in basis points, should be a positive number
  type: SwapSide;
  curveIds: ReservoirPoolTypes[];
  path: Address[];
  // initcode hash for both constant product and stable?
};

export type DexParams = {
  // TODO: DexParams is set of parameters the can
  // be used to initiate a DEX fork.
  // Complete me!
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
