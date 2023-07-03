import { DeepReadonly } from 'ts-essentials';
import { PoolState } from '../types';
import { SwapSide } from '@paraswap/core';
import { OutputResult } from '../../uniswap-v3/types';

export function queryOutputs(
  state: DeepReadonly<PoolState>,
  amounts: bigint[],
  zeroForOne: boolean,
  side: SwapSide,
): OutputResult {
  // TODO

  return {
    outputs: [],
    tickCounts: [],
  };
}

export function mutateStateOnSwap() {
  // TODO
}

export function mutateStateOnLP() {
  // TODO
}
