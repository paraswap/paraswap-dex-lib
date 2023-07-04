import { DeepReadonly } from 'ts-essentials';
import { PoolState } from '../types';
import { SwapSide } from '@paraswap/core';
import { OutputResult } from '../../uniswap-v3/types';
import {
  _writeTimepoint,
  getSingleTimepoint,
  transformAlgebraToMinUniv3PoolState,
} from './AlgebraXUniV3';
import { Tick } from '../../uniswap-v3/contract-math/Tick';
import { TickBitMap } from '../../uniswap-v3/contract-math/TickBitMap';
import { MAX_LIQUIDITY_PER_TICK, TICK_SPACING } from './Constants';
import { SqrtPriceMath } from '../../uniswap-v3/contract-math/SqrtPriceMath';
import { TickMath } from '../../uniswap-v3/contract-math/TickMath';
import { LiquidityMath } from '../../uniswap-v3/contract-math/LiquidityMath';

type UpdatePositionCache = {
  price: bigint;
  tick: bigint;
  timepointIndex: number;
};

class AlgebraMathClass {
  queryOutputs(
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

  _calculateSwapAndLock() {}

  // same as uniswapV3Pool: line 328 -> 369
  _getAmountsForLiquidity(
    bottomTick: bigint,
    topTick: bigint,
    liquidityDelta: bigint,
    currentTick: bigint,
    currentPrice: bigint,
  ) {
    let amount0;
    let amount1;
    let globalLiquidityDelta;
    // If current tick is less than the provided bottom one then only the token0 has to be provided
    if (currentTick < bottomTick) {
      amount0 = SqrtPriceMath._getAmount0DeltaO(
        TickMath.getSqrtRatioAtTick(bottomTick),
        TickMath.getSqrtRatioAtTick(topTick),
        liquidityDelta,
      );
    } else if (currentTick < topTick) {
      amount0 = SqrtPriceMath._getAmount0DeltaO(
        currentPrice,
        TickMath.getSqrtRatioAtTick(topTick),
        liquidityDelta,
      );
      amount1 = SqrtPriceMath._getAmount1DeltaO(
        TickMath.getSqrtRatioAtTick(bottomTick),
        currentPrice,
        liquidityDelta,
      );

      globalLiquidityDelta = liquidityDelta;
    }
    // If current tick is greater than the provided top one then only the token1 has to be provided
    else {
      amount1 = SqrtPriceMath._getAmount1DeltaO(
        TickMath.getSqrtRatioAtTick(bottomTick),
        TickMath.getSqrtRatioAtTick(topTick),
        liquidityDelta,
      );
    }

    return [amount0, amount1, globalLiquidityDelta];
  }

  _updatePositionTicksAndFees(
    state: PoolState,
    bottomTick: bigint,
    topTick: bigint,
    liquidityDelta: bigint,
  ) {
    const { globalState, liquidity, volumePerLiquidityInBlock } = state;
    let toggledBottom: boolean = false;
    let toggledTop: boolean = false;
    const univ3LikeState = transformAlgebraToMinUniv3PoolState(state);
    const cache: UpdatePositionCache = {
      price: globalState.price,
      tick: globalState.tick,
      timepointIndex: globalState.timepointIndex,
    };
    // skip position logic
    // skip fee logic

    if (liquidityDelta !== 0n) {
      const time = this._blockTimestamp(state);
      const [tickCumulative, secondsPerLiquidityCumulative] =
        getSingleTimepoint(
          state,
          time,
          0n,
          cache.tick,
          cache.timepointIndex,
          liquidity,
        );
      if (
        Tick.update(
          univ3LikeState,
          bottomTick,
          cache.tick,
          liquidityDelta,
          secondsPerLiquidityCumulative,
          tickCumulative,
          time,
          false, // isTopTick,
          MAX_LIQUIDITY_PER_TICK,
        )
      ) {
        toggledBottom = true;
        TickBitMap.flipTick(univ3LikeState, bottomTick, TICK_SPACING);
      }
      if (
        Tick.update(
          univ3LikeState,
          topTick,
          cache.tick,
          liquidityDelta,
          secondsPerLiquidityCumulative,
          tickCumulative,
          time,
          true, // isTopTick
          MAX_LIQUIDITY_PER_TICK,
        )
      ) {
        toggledTop = true;
        TickBitMap.flipTick(univ3LikeState, topTick, TICK_SPACING);
      }
    }

    // skip fee && position related stuffs

    // same as UniwapV3Pool.sol line 327 ->   if (params.liquidityDelta != 0) {
    if (liquidityDelta !== 0n) {
      // if liquidityDelta is negative and the tick was toggled, it means that it should not be initialized anymore, so we delete it
      if (liquidityDelta < 0) {
        if (toggledBottom) Tick.clear(univ3LikeState, bottomTick);
        if (toggledTop) Tick.clear(univ3LikeState, topTick);
      }
      // same as UniswapV3Pool.sol line 331 ? -> amount0 = SqrtPriceMath.getAmount0Delta(
      // skip amount0 and amount1 as already read from event
      const [, , globalLiquidityDelta] = this._getAmountsForLiquidity(
        bottomTick,
        topTick,
        liquidityDelta,
        cache.tick,
        cache.price,
      );
      if (globalLiquidityDelta != 0n) {
        let liquidityBefore = liquidity;
        // same as UniswapV3Pool line 340 -> (slot0.observationIndex, slot0.observationCardinality) = observations.write(
        let newTimepointIndex = _writeTimepoint(
          state,
          cache.timepointIndex,
          this._blockTimestamp(state),
          cache.tick,
          liquidityBefore,
          volumePerLiquidityInBlock,
        );
        if (cache.timepointIndex != newTimepointIndex) {
          // skip fee, updated via another handler
          //globalState.fee = _getNewFee(_blockTimestamp(), cache.tick, newTimepointIndex, liquidityBefore);
          globalState.timepointIndex = newTimepointIndex;
          state.volumePerLiquidityInBlock = 0n;
        }
        // same as UniswapV3Pool line 361 ->  liquidity = LiquidityMath.addDelta(liquidityBefore, params.liquidityDelta);
        state.liquidity = LiquidityMath.addDelta(
          liquidityBefore,
          liquidityDelta,
        );
      }
    }
  }

  _blockTimestamp(state: DeepReadonly<PoolState>) {
    return BigInt.asUintN(32, state.blockTimestamp);
  }
}

export const AlgebraMath = new AlgebraMathClass();
