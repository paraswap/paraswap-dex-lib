import { PoolState } from '../types';
import { FixedPoint128 } from './FixedPoint128';
import { FullMath } from './FullMath';
import { LiquidityMath } from './LiquidityMath';
import { Oracle } from './Oracle';
import { SqrtPriceMath } from './SqrtPriceMath';
import { SwapMath } from './SwapMath';
import { Tick } from './Tick';
import { TickBitMap } from './TickBitMap';
import { TickMath } from './TickMath';
import { _require } from '../../../utils';

type ModifyPositionParams = {
  tickLower: bigint;
  tickUpper: bigint;
  liquidityDelta: bigint;
};

class UniswapV3Math {
  swap(
    poolState: PoolState,
    zeroForOne: boolean,
    amountSpecified: bigint,
    sqrtPriceLimitX96: bigint,
  ): { amount0: bigint; amount1: bigint } {
    _require(
      amountSpecified != 0n,
      'AS',
      { amountSpecified },
      'amountSpecified != 0n',
    );

    const slot0Start = poolState.slot0;

    _require(
      zeroForOne
        ? sqrtPriceLimitX96 < slot0Start.sqrtPriceX96 &&
            sqrtPriceLimitX96 > TickMath.MIN_SQRT_RATIO
        : sqrtPriceLimitX96 > slot0Start.sqrtPriceX96 &&
            sqrtPriceLimitX96 < TickMath.MAX_SQRT_RATIO,
      'SPL',
      { zeroForOne, sqrtPriceLimitX96, slot0Start },
      'zeroForOne ? sqrtPriceLimitX96 < slot0Start.sqrtPriceX96 && sqrtPriceLimitX96 > TickMath.MIN_SQRT_RATIO : sqrtPriceLimitX96 > slot0Start.sqrtPriceX96 && sqrtPriceLimitX96 < TickMath.MAX_SQRT_RATIO',
    );

    const cache = {
      liquidityStart: poolState.liquidity,
      blockTimestamp: this._blockTimestamp(poolState),
      feeProtocol: zeroForOne
        ? slot0Start.feeProtocol % 16n
        : slot0Start.feeProtocol >> 4n,
      secondsPerLiquidityCumulativeX128: 0n,
      tickCumulative: 0n,
      computedLatestObservation: false,
    };

    const exactInput = amountSpecified > 0n;

    const state = {
      amountSpecifiedRemaining: amountSpecified,
      amountCalculated: 0n,
      sqrtPriceX96: slot0Start.sqrtPriceX96,
      tick: slot0Start.tick,
      feeGrowthGlobalX128: zeroForOne
        ? poolState.feeGrowthGlobal0X128
        : poolState.feeGrowthGlobal1X128,
      protocolFee: 0n,
      liquidity: cache.liquidityStart,
    };

    while (
      state.amountSpecifiedRemaining != 0n &&
      state.sqrtPriceX96 != sqrtPriceLimitX96
    ) {
      const step = {
        sqrtPriceStartX96: 0n,
        tickNext: 0n,
        initialized: false,
        sqrtPriceNextX96: 0n,
        amountIn: 0n,
        amountOut: 0n,
        feeAmount: 0n,
      };

      step.sqrtPriceStartX96 = state.sqrtPriceX96;

      const bitMapResult = TickBitMap.nextInitializedTickWithinOneWord(
        poolState,
        state.tick,
        poolState.tickSpacing,
        zeroForOne,
      );
      step.tickNext = bitMapResult.next;
      step.initialized = bitMapResult.initialized;

      if (step.tickNext < TickMath.MIN_TICK) {
        step.tickNext = TickMath.MIN_TICK;
      } else if (step.tickNext > TickMath.MAX_TICK) {
        step.tickNext = TickMath.MAX_TICK;
      }

      step.sqrtPriceNextX96 = TickMath.getSqrtRatioAtTick(step.tickNext);

      const swapStepResult = SwapMath.computeSwapStep(
        state.sqrtPriceX96,
        (
          zeroForOne
            ? step.sqrtPriceNextX96 < sqrtPriceLimitX96
            : step.sqrtPriceNextX96 > sqrtPriceLimitX96
        )
          ? sqrtPriceLimitX96
          : step.sqrtPriceNextX96,
        state.liquidity,
        state.amountSpecifiedRemaining,
        poolState.fee,
      );

      state.sqrtPriceX96 = swapStepResult.sqrtRatioNextX96;
      step.amountIn = swapStepResult.amountIn;
      step.amountOut = swapStepResult.amountOut;
      step.feeAmount = swapStepResult.feeAmount;

      if (exactInput) {
        state.amountSpecifiedRemaining -= step.amountIn + step.feeAmount;
        state.amountCalculated = state.amountCalculated - step.amountOut;
      } else {
        state.amountSpecifiedRemaining += step.amountOut;
        state.amountCalculated =
          state.amountCalculated + step.amountIn + step.feeAmount;
      }

      if (cache.feeProtocol > 0n) {
        const delta = step.feeAmount / cache.feeProtocol;
        step.feeAmount -= delta;
        state.protocolFee += delta;
      }

      if (state.liquidity > 0n)
        state.feeGrowthGlobalX128 += FullMath.mulDiv(
          step.feeAmount,
          FixedPoint128.Q128,
          state.liquidity,
        );

      if (state.sqrtPriceX96 == step.sqrtPriceNextX96) {
        if (step.initialized) {
          if (!cache.computedLatestObservation) {
            [cache.tickCumulative, cache.secondsPerLiquidityCumulativeX128] =
              Oracle.observeSingle(
                poolState,
                cache.blockTimestamp,
                0n,
                slot0Start.tick,
                slot0Start.observationIndex,
                cache.liquidityStart,
                slot0Start.observationCardinality,
              );
            cache.computedLatestObservation = true;
          }
          let liquidityNet = Tick.cross(
            poolState,
            step.tickNext,
            zeroForOne
              ? state.feeGrowthGlobalX128
              : poolState.feeGrowthGlobal0X128,
            zeroForOne
              ? poolState.feeGrowthGlobal1X128
              : state.feeGrowthGlobalX128,
            cache.secondsPerLiquidityCumulativeX128,
            cache.tickCumulative,
            cache.blockTimestamp,
          );
          if (zeroForOne) liquidityNet = -liquidityNet;

          state.liquidity = LiquidityMath.addDelta(
            state.liquidity,
            liquidityNet,
          );
        }

        state.tick = zeroForOne ? step.tickNext - 1n : step.tickNext;
      } else if (state.sqrtPriceX96 != step.sqrtPriceStartX96) {
        state.tick = TickMath.getTickAtSqrtRatio(state.sqrtPriceX96);
      }
    }

    // update tick and write an oracle entry if the tick change
    if (state.tick != slot0Start.tick) {
      const [observationIndex, observationCardinality] = Oracle.write(
        poolState,
        slot0Start.observationIndex,
        cache.blockTimestamp,
        slot0Start.tick,
        cache.liquidityStart,
        slot0Start.observationCardinality,
        slot0Start.observationCardinalityNext,
      );

      [
        poolState.slot0.sqrtPriceX96,
        poolState.slot0.tick,
        poolState.slot0.observationIndex,
        poolState.slot0.observationCardinality,
      ] = [
        state.sqrtPriceX96,
        state.tick,
        observationIndex,
        observationCardinality,
      ];
    } else {
      poolState.slot0.sqrtPriceX96 = state.sqrtPriceX96;
    }

    if (cache.liquidityStart != state.liquidity)
      poolState.liquidity = state.liquidity;

    if (zeroForOne) {
      poolState.feeGrowthGlobal0X128 = state.feeGrowthGlobalX128;
    } else {
      poolState.feeGrowthGlobal1X128 = state.feeGrowthGlobalX128;
    }

    const [amount0, amount1] =
      zeroForOne == exactInput
        ? [
            amountSpecified - state.amountSpecifiedRemaining,
            state.amountCalculated,
          ]
        : [
            state.amountCalculated,
            amountSpecified - state.amountSpecifiedRemaining,
          ];
    return { amount0, amount1 };
  }

  _modifyPosition(
    state: PoolState,
    params: ModifyPositionParams,
  ): [bigint, bigint] {
    this.checkTicks(params.tickLower, params.tickUpper);

    const _slot0 = state.slot0;

    this._updatePosition(
      state,
      params.tickLower,
      params.tickUpper,
      params.liquidityDelta,
      _slot0.tick,
    );

    let amount0 = 0n;
    let amount1 = 0n;
    if (params.liquidityDelta !== 0n) {
      if (_slot0.tick < params.tickLower) {
        amount0 = SqrtPriceMath._getAmount0DeltaO(
          TickMath.getSqrtRatioAtTick(params.tickLower),
          TickMath.getSqrtRatioAtTick(params.tickUpper),
          params.liquidityDelta,
        );
      } else if (_slot0.tick < params.tickUpper) {
        const liquidityBefore = state.liquidity;

        [state.slot0.observationIndex, state.slot0.observationCardinality] =
          Oracle.write(
            state,
            _slot0.observationIndex,
            this._blockTimestamp(state),
            _slot0.tick,
            liquidityBefore,
            _slot0.observationCardinality,
            _slot0.observationCardinalityNext,
          );

        amount0 = SqrtPriceMath._getAmount0DeltaO(
          _slot0.sqrtPriceX96,
          TickMath.getSqrtRatioAtTick(params.tickUpper),
          params.liquidityDelta,
        );
        amount1 = SqrtPriceMath._getAmount1DeltaO(
          TickMath.getSqrtRatioAtTick(params.tickLower),
          _slot0.sqrtPriceX96,
          params.liquidityDelta,
        );

        state.liquidity = LiquidityMath.addDelta(
          liquidityBefore,
          params.liquidityDelta,
        );
      } else {
        amount1 = SqrtPriceMath._getAmount1DeltaO(
          TickMath.getSqrtRatioAtTick(params.tickLower),
          TickMath.getSqrtRatioAtTick(params.tickUpper),
          params.liquidityDelta,
        );
      }
    }
    return [amount0, amount1];
  }

  private _updatePosition(
    state: PoolState,
    tickLower: bigint,
    tickUpper: bigint,
    liquidityDelta: bigint,
    tick: bigint,
  ): void {
    const _feeGrowthGlobal0X128 = state.feeGrowthGlobal0X128;
    const _feeGrowthGlobal1X128 = state.feeGrowthGlobal1X128;

    // if we need to update the ticks, do it
    let flippedLower = false;
    let flippedUpper = false;
    if (liquidityDelta !== 0n) {
      const time = this._blockTimestamp(state);
      const [tickCumulative, secondsPerLiquidityCumulativeX128] =
        Oracle.observeSingle(
          state,
          time,
          0n,
          state.slot0.tick,
          state.slot0.observationIndex,
          state.liquidity,
          state.slot0.observationCardinality,
        );

      flippedLower = Tick.update(
        state,
        tickLower,
        tick,
        liquidityDelta,
        _feeGrowthGlobal0X128,
        _feeGrowthGlobal1X128,
        secondsPerLiquidityCumulativeX128,
        tickCumulative,
        time,
        false,
        state.maxLiquidityPerTick,
      );
      flippedUpper = Tick.update(
        state,
        tickUpper,
        tick,
        liquidityDelta,
        _feeGrowthGlobal0X128,
        _feeGrowthGlobal1X128,
        secondsPerLiquidityCumulativeX128,
        tickCumulative,
        time,
        true,
        state.maxLiquidityPerTick,
      );

      if (flippedLower) {
        TickBitMap.flipTick(state, tickLower, state.tickSpacing);
      }
      if (flippedUpper) {
        TickBitMap.flipTick(state, tickUpper, state.tickSpacing);
      }
    }

    // clear any tick data that is no longer needed
    if (liquidityDelta < 0n) {
      if (flippedLower) {
        Tick.clear(state, tickLower);
      }
      if (flippedUpper) {
        Tick.clear(state, tickUpper);
      }
    }
  }

  private checkTicks(tickLower: bigint, tickUpper: bigint) {
    _require(
      tickLower < tickUpper,
      'TLU',
      { tickLower, tickUpper },
      'tickLower < tickUpper',
    );
    _require(
      tickLower >= TickMath.MIN_TICK,
      'TLM',
      { tickLower },
      'tickLower >= TickMath.MIN_TICK',
    );
    _require(
      tickUpper <= TickMath.MAX_TICK,
      'TUM',
      { tickUpper },
      'tickUpper <= TickMath.MAX_TICK',
    );
  }

  private _blockTimestamp(state: PoolState) {
    // Here we should have truncated to uint32 byte, but because in near future (132 years) it will not
    // be a problem, so I leave it as it is
    return state.blockTimestamp;
  }
}

export const uniswapV3Math = new UniswapV3Math();
