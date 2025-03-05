import { DeepReadonly } from 'ts-essentials';
import { PoolState } from '../types';
import { SwapSide } from '@paraswap/core';

class UniswapV4Math {
  swap(poolState: DeepReadonly<PoolState>, side: SwapSide) {
    const slot0Start = poolState.slot0;
    const isSell = side === SwapSide.SELL;
  }
}

export const uniswapV4Math = new UniswapV4Math();
