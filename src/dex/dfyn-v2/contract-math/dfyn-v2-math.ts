import _ from 'lodash';
import {
  OutputResult,
  PoolState,
  Slot0,
  TickInfo,
  StructHelper,
} from '../types';
import { LiquidityMath } from './LiquidityMath';
import { SqrtPriceMath } from './SqrtPriceMath';
import { Ticks } from './Ticks';
import { TickMath } from './TickMath';
import { _require } from '../../../utils';
import { DeepReadonly } from 'ts-essentials';
import { NumberAsString, SwapSide } from '@paraswap/core';
import { BI_MAX_INT } from '../../../bigint-constants';
import {
  MAX_PRICING_COMPUTATION_STEPS_ALLOWED,
  OUT_OF_RANGE_ERROR_POSTFIX,
} from '../constants';
import { SwapExecuter } from './SwapExecuter';
import { stat } from 'fs';
//import { StructHelper } from './IConcentratedLiquidityPool';
import { FeeHandler } from './FeeHandler';

// type ModifyPositionParams = {
//   tickLower: bigint;
//   tickUpper: bigint;
//   liquidityDelta: bigint;
// };

// type PriceComputationState = {
//   amountSpecifiedRemaining: bigint;
//   amountIn: bigint;
//   amountOut:bigint;
//   exactIn: boolean;
//   amountCalculated: bigint;
//   sqrtPriceX96: bigint;
//   tick: bigint;
//   protocolFee: bigint;
//   liquidity: bigint;
//   swapFee: bigint;
//   isFirstCycleState: boolean;
// };

// type PriceComputationCache = {
//   liquidityStart: bigint;
//   blockTimestamp: bigint;
//   feeProtocol: bigint;
//   secondsPerLiquidityCumulativeX128: bigint;
//   tickCumulative: bigint;
//   computedLatestObservation: boolean;
//   tickCount: number;
//   exactIn: number;
//   amountIn: number;
//   amountOut: number;

// };

// type PriceComputationCache = {
//   protocolFee: bigint,
//   feeGrowthGlobalA: zeroForOne ? poolState.feeGrowthGlobal1 : feeGrowthGlobal0,
//   feeGrowthGlobalB: zeroForOne ? feeGrowthGlobal0 : feeGrowthGlobal1,
//   currentPrice: bigint,
//   nearestPriceCached: bigint,
//   currentLiquidity: bigint,
//   amountIn: quantity > 0 ? quantity as number : 0,
//   amountOut: quantity > 0 ? 0 : (-quantity) as number,
//   totalAmount: 0,
//   exactIn: quantity > 0,
//   nextTickToCross: boolean,
//   limitOrderAmountOut: 0,
//   limitOrderAmountIn: 0,
//   limitOrderReserve: zeroForOne ? limitOrderReserve0 : limitOrderReserve1,
//   limitOrderFeeGrowth: zeroForOne ? token0LimitOrderFee : token1LimitOrderFee,
//   token0LimitOrderFee: token0LimitOrderFee,
//   token1LimitOrderFee: token1LimitOrderFee
// }

function _updatePriceComputationObjects<T extends StructHelper['SwapCache']>(
  toUpdate: T,
  updateBy: T,
) {
  for (const k of Object.keys(updateBy) as (keyof T)[]) {
    toUpdate[k] = updateBy[k];
  }
}

function _priceComputationCycles(
  poolState: DeepReadonly<PoolState>,
  ticksCopy: Record<NumberAsString, TickInfo>,
  slot0Start: Slot0,
  //state: PriceComputationState,
  cache: StructHelper['SwapCache'],
  sqrtPriceLimitX96: bigint,
  zeroForOne: boolean,
  exactInput: boolean,
): [
  // result
  StructHelper['SwapCache'],
  // Latest calculated full cycle state we can use for bigger amounts
  {
    //latestFullCycleState: PriceComputationState;
    latestFullCycleCache: StructHelper['SwapCache'];
  },
] {
  //const latestFullCycleState: PriceComputationState = { ...state };

  if (cache.tickCount == 0) {
    cache.tickCount = 1;
  }
  const latestFullCycleCache: StructHelper['SwapCache'] = { ...cache };

  // We save tick before any change. Later we use this to restore
  // state before last step
  let lastTicksCopy: { index: number; tick: TickInfo } | undefined;

  // const diff = BigInt(Date.now() / 1000)-(poolState.lastObservation);
  // if (diff > 0n && cache.currentLiquidity > 0n) {
  //   poolState.lastObservation = BigInt(Date.now() / 1000);
  //   poolState.secondsGrowthGlobal = poolState.secondsGrowthGlobal + (diff*(BigInt((2**128))/(cache.currentLiquidity)));
  // }

  let i = 0;
  for (; cache.exactIn ? cache.amountIn != 0n : cache.amountOut != 0n; ++i) {
    if (
      latestFullCycleCache.tickCount + i >
      MAX_PRICING_COMPUTATION_STEPS_ALLOWED
    ) {
      if (exactInput) {
        cache.amountOut = 0n;
      } else {
        cache.amountIn = 0n;
      }
      break;
    }
    const swapLocal: StructHelper['SwapCacheLocal'] = {
      nextTickPrice: TickMath.getSqrtRatioAtTick(cache.nextTickToCross),
      cross: false,
      fee: 0n,
      amountIn: 0n,
      amountOut: 0n,
    };

    const ConcStruct: StructHelper['ConcStruct'] = {
      currentPrice: cache.currentPrice,
      amountIn: cache.amountIn,
      amountOut: cache.amountOut,
      exactIn: cache.exactIn,
      currentLiquidity: cache.currentLiquidity,
    };

    _require(
      cache.nextTickToCross === TickMath.MIN_TICK ||
        cache.nextTickToCross === TickMath.MAX_TICK,
      'E4',
    );

    if (cache.currentLiquidity !== 0n) {
      const { amountOut, currentPrice, cross, amountIn, fee } =
        SwapExecuter._executeConcentrateLiquidity(
          ConcStruct,
          zeroForOne,
          swapLocal.nextTickPrice,
          poolState.swapFee,
        );

      cache.amountOut = amountOut;
      cache.currentPrice = currentPrice;
      swapLocal.cross = cross;
      cache.amountIn = amountIn;
      swapLocal.fee = fee;

      cache.totalAmount += cache.exactIn ? cache.amountOut : cache.amountIn;

      [cache.amountOut, cache.amountIn] = cache.exactIn
        ? [0n, cache.amountIn]
        : [cache.amountOut, 0n];

      if (swapLocal.fee !== 0n) {
        const {
          protocolFee: newProtocolFee,
          feeGrowthGlobal: newFeeGrowthGlobalB,
        } = FeeHandler.handleFees({
          feeAmount: swapLocal.fee,
          dfynFee: poolState.dfynFee,
          protocolFee: cache.protocolFee,
          currentLiquidity: cache.currentLiquidity,
          feeGrowthGlobal: cache.feeGrowthGlobalB,
        });
        cache.protocolFee = newProtocolFee;
        cache.feeGrowthGlobalB = newFeeGrowthGlobalB;
      }
    } else {
      cache.currentPrice = TickMath.getSqrtRatioAtTick(cache.nextTickToCross);
      swapLocal.cross = true;
    }
    if (
      !swapLocal.cross &&
      cache.currentPrice == swapLocal.nextTickPrice &&
      !zeroForOne
    ) {
      cache.nearestPriceCached = cache.currentPrice - 1n;
    } else {
      cache.nearestPriceCached = cache.currentPrice;
    }
    if (swapLocal.cross) {
      const limitOrderLiquidity = zeroForOne
        ? poolState.limitOrderTicks[Number(cache.nextTickToCross)]
            .token1Liquidity
        : poolState.limitOrderTicks[Number(cache.nextTickToCross)]
            .token0Liquidity;
      if (limitOrderLiquidity != 0n) {
        const response: StructHelper['ExecuteLimitResponse'] =
          SwapExecuter._executeLimitOrder(
            {
              sqrtpriceX96: swapLocal.nextTickPrice,
              tick: cache.nextTickToCross,
              zeroForOne: zeroForOne,
              amountIn: cache.amountIn,
              amountOut: cache.amountOut,
              limitOrderAmountOut: cache.limitOrderAmountOut,
              limitOrderAmountIn: cache.limitOrderAmountIn,
              cross: swapLocal.cross,
              token0LimitOrderFee: cache.token0LimitOrderFee,
              token1LimitOrderFee: cache.token1LimitOrderFee,
              exactIn: cache.exactIn,
              limitOrderFee: poolState.limitOrderFee,
            },
            poolState.limitOrderTicks,
            limitOrderLiquidity,
          );
        // Set the state of cache and other variables in scope
        cache.amountIn = response.amountIn;
        cache.amountOut = response.amountOut;
        swapLocal.cross = response.cross;
        cache.token0LimitOrderFee = response.token0LimitOrderFee;
        cache.token1LimitOrderFee = response.token1LimitOrderFee;
        cache.limitOrderAmountOut = response.limitOrderAmountOut;
        cache.limitOrderAmountIn = response.limitOrderAmountIn;

        // reset amountIn and amountOut and update totalAmount
        cache.totalAmount += cache.exactIn ? cache.amountOut : cache.amountIn;
        [cache.amountOut, cache.amountIn] = cache.exactIn
          ? [0n, cache.amountIn]
          : [cache.amountOut, 0n];
      }
      if (swapLocal.cross) {
        if (cache.exactIn ? cache.amountIn === 0n : cache.amountOut === 0n) {
          const castTickNext = Number(cache.nextTickToCross);
          lastTicksCopy = {
            index: castTickNext,
            tick: { ...ticksCopy[castTickNext] },
          };
        }

        [cache.currentLiquidity, cache.nextTickToCross] = Ticks.cross(
          ticksCopy,
          {
            nextTickToCross: cache.nextTickToCross,
            currentLiquidity: cache.currentLiquidity,
          },
          poolState.secondsGrowthGlobal,
          cache.feeGrowthGlobalA,
          cache.feeGrowthGlobalB,
          zeroForOne,
          poolState.tickSpacing,
        );
      } else {
        cache.nearestPriceCached = zeroForOne
          ? cache.currentPrice + 1n
          : cache.currentPrice - 1n;
      }
    }
    if (cache.exactIn ? cache.amountIn != 0n : cache.amountOut != 0n) {
      _updatePriceComputationObjects(latestFullCycleCache, cache);
      // If it last cycle, check if ticks were changed and then restore previous state
      // for next calculations
    } else if (lastTicksCopy !== undefined) {
      ticksCopy[lastTicksCopy.index] = lastTicksCopy.tick;
    }
  }
  if (i > 1) {
    latestFullCycleCache.tickCount += i - 1;
  }

  if (cache.exactIn && cache.amountIn != 0n) {
    cache.amountIn = 0n;
    cache.totalAmount = 0n;
  } else if (!cache.exactIn && cache.amountOut != 0n) {
    cache.amountOut = 0n;
    cache.totalAmount = 0n;
  }

  return [cache, { latestFullCycleCache }];
}

class DfynV2Math {
  queryOutputs(
    poolState: DeepReadonly<PoolState>,
    // Amounts must increase
    amounts: bigint[],
    zeroForOne: boolean,
    side: SwapSide,
  ): OutputResult {
    const slot0Start = poolState.slot0;

    const isSell = side === SwapSide.SELL;

    // While calculating, ticks are changing, so to not change the actual state,
    // we use copy
    const ticksCopy = _.cloneDeep(poolState.ticks);

    const sqrtPriceLimitX96 = zeroForOne
      ? TickMath.MIN_SQRT_RATIO + 1n
      : TickMath.MAX_SQRT_RATIO - 1n;

    const cache: StructHelper['SwapCache'] = {
      currentLiquidity: poolState.liquidity,
      blockTimestamp: this._blockTimestamp(poolState),
      protocolFee: 0n,
      tickCount: 0,
      nextTickToCross: zeroForOne
        ? slot0Start.tick
        : ticksCopy[Number(slot0Start.tick)].nextTick,
      amountIn: 0n,
      amountOut: 0n,
      totalAmount: 0n,
      isFirstCycleState: true,
      exactIn: false,
      feeGrowthGlobalA: zeroForOne
        ? poolState.feeGrowthGlobal1
        : poolState.feeGrowthGlobal0,
      feeGrowthGlobalB: zeroForOne
        ? poolState.feeGrowthGlobal0
        : poolState.feeGrowthGlobal1,
      nearestPriceCached: poolState.nearestPrice,
      limitOrderAmountOut: 0n,
      limitOrderAmountIn: 0n,
      limitOrderReserve: zeroForOne
        ? poolState.limitOrderReserve0
        : poolState.limitOrderReserve1,
      limitOrderFeeGrowth: zeroForOne
        ? poolState.token0LimitOrderFee
        : poolState.token1LimitOrderFee,
      token0LimitOrderFee: poolState.token0LimitOrderFee,
      token1LimitOrderFee: poolState.token1LimitOrderFee,
      currentPrice: poolState.price,
    };

    let isOutOfRange = false;
    let previousAmount = 0n;

    const outputs = new Array(amounts.length);
    const tickCounts = new Array(amounts.length);
    for (const [i, amount] of amounts.entries()) {
      if (amount === 0n) {
        outputs[i] = 0n;
        tickCounts[i] = 0;
        continue;
      }

      const amountSpecified = isSell
        ? BigInt.asIntN(256, amount)
        : -BigInt.asIntN(256, amount);

      if (cache.isFirstCycleState) {
        // Set first non zero amount
        if (isSell) {
          cache.amountIn = amountSpecified;
        } else {
          cache.amountOut = amountSpecified;
        }
        cache.isFirstCycleState = false;
      } else {
        if (isSell) {
          cache.amountIn =
            amountSpecified - (previousAmount - cache.totalAmount);
        } else {
          cache.amountOut =
            amountSpecified - (previousAmount - cache.totalAmount);
        }
      }

      const exactInput = amountSpecified > 0n;

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

      if (!isOutOfRange) {
        const [finalCache, { latestFullCycleCache }] = _priceComputationCycles(
          poolState,
          ticksCopy,
          slot0Start,
          cache,
          sqrtPriceLimitX96,
          zeroForOne,
          exactInput,
        );
        if (
          (finalCache.amountIn === 0n && finalCache.totalAmount === 0n) ||
          (finalCache.amountOut === 0n && finalCache.totalAmount === 0n)
        ) {
          isOutOfRange = true;
          outputs[i] = 0n;
          tickCounts[i] = 0;
          continue;
        }

        // We use it on next step to correct cache.amountIn or cache.AmountOut
        previousAmount = amountSpecified;

        // First extract calculated values
        const [amount0, amount1] =
          zeroForOne === exactInput
            ? [amountSpecified - finalCache.amountIn, finalCache.totalAmount]
            : [finalCache.totalAmount, amountSpecified - finalCache.amountOut];

        // Update for next amount
        // _updatePriceComputationObjects(state, latestFullCycleState);
        _updatePriceComputationObjects(cache, latestFullCycleCache);

        if (isSell) {
          outputs[i] = BigInt.asUintN(256, -(zeroForOne ? amount1 : amount0));
          tickCounts[i] = latestFullCycleCache.tickCount;
          continue;
        } else {
          outputs[i] = zeroForOne
            ? BigInt.asUintN(256, amount0)
            : BigInt.asUintN(256, amount1);
          tickCounts[i] = latestFullCycleCache.tickCount;
          continue;
        }
      } else {
        outputs[i] = 0n;
        tickCounts[i] = 0;
      }
    }

    return {
      outputs,
      tickCounts,
    };
  }

  swapFromEvent(
    poolState: PoolState,
    newSqrtPriceX96: bigint,
    newTick: bigint,
    newLiquidity: bigint,
    zeroForOne: boolean,
  ): void {
    // const ticks = poolState.ticks
    //const limitOrderTicks = poolState.limitOrderTicks
    const slot0Start = poolState.slot0;

    const cache: StructHelper['SwapCache'] = {
      currentLiquidity: poolState.liquidity,
      blockTimestamp: this._blockTimestamp(poolState),
      protocolFee: 0n,
      tickCount: 0,
      nextTickToCross: zeroForOne
        ? slot0Start.tick
        : poolState.ticks[Number(slot0Start.tick)].nextTick,
      amountIn: BI_MAX_INT,
      amountOut: BI_MAX_INT,
      totalAmount: 0n,
      isFirstCycleState: true,
      exactIn: false,
      feeGrowthGlobalA: zeroForOne
        ? poolState.feeGrowthGlobal1
        : poolState.feeGrowthGlobal0,
      feeGrowthGlobalB: zeroForOne
        ? poolState.feeGrowthGlobal0
        : poolState.feeGrowthGlobal1,
      nearestPriceCached: poolState.nearestPrice,
      limitOrderAmountOut: 0n,
      limitOrderAmountIn: 0n,
      limitOrderReserve: zeroForOne
        ? poolState.limitOrderReserve0
        : poolState.limitOrderReserve1,
      limitOrderFeeGrowth: zeroForOne
        ? poolState.token0LimitOrderFee
        : poolState.token1LimitOrderFee,
      token0LimitOrderFee: poolState.token0LimitOrderFee,
      token1LimitOrderFee: poolState.token1LimitOrderFee,
      currentPrice: poolState.price,
    };

    // Because I didn't have all variables, adapted loop stop with state.tick !== newTick
    // condition. This cycle need only to calculate Tick.cross() function values
    // It means that we are interested in cycling only if state.tick !== newTick
    // When they become equivalent, we proceed with state updating part as normal
    // And if assumptions regarding this cycle are correct, we don't need to process
    // the last cycle when state.tick === newTick
    while (
      slot0Start.tick !== newTick &&
      slot0Start.sqrtPriceX96 !== newSqrtPriceX96
    ) {
      const swapLocal: StructHelper['SwapCacheLocal'] = {
        nextTickPrice: TickMath.getSqrtRatioAtTick(cache.nextTickToCross),
        cross: false,
        fee: 0n,
        amountIn: 0n,
        amountOut: 0n,
      };

      _require(
        cache.nextTickToCross === TickMath.MIN_TICK ||
          cache.nextTickToCross === TickMath.MAX_TICK,
        'E4',
      );

      if (cache.currentLiquidity !== 0n) {
        const { amountOut, currentPrice, cross, amountIn, fee } =
          SwapExecuter._executeConcentrateLiquidity(
            {
              currentPrice: cache.currentPrice,
              amountIn: cache.amountIn,
              amountOut: cache.amountOut,
              exactIn: cache.exactIn,
              currentLiquidity: cache.currentLiquidity,
            },
            zeroForOne,
            swapLocal.nextTickPrice,
            poolState.swapFee,
          );

        cache.amountOut = amountOut;
        cache.currentPrice = currentPrice;
        swapLocal.cross = cross;
        cache.amountIn = amountIn;
        swapLocal.fee = fee;

        cache.totalAmount += cache.exactIn ? cache.amountOut : cache.amountIn;

        [cache.amountOut, cache.amountIn] = cache.exactIn
          ? [0n, cache.amountIn]
          : [cache.amountOut, 0n];

        if (swapLocal.fee !== 0n) {
          const {
            protocolFee: newProtocolFee,
            feeGrowthGlobal: newFeeGrowthGlobalB,
          } = FeeHandler.handleFees({
            feeAmount: swapLocal.fee,
            dfynFee: poolState.dfynFee,
            protocolFee: cache.protocolFee,
            currentLiquidity: cache.currentLiquidity,
            feeGrowthGlobal: cache.feeGrowthGlobalB,
          });
          cache.protocolFee = newProtocolFee;
          cache.feeGrowthGlobalB = newFeeGrowthGlobalB;
        }
      } else {
        cache.currentPrice = TickMath.getSqrtRatioAtTick(cache.nextTickToCross);
        swapLocal.cross = true;
      }

      if (
        !swapLocal.cross &&
        cache.currentPrice == swapLocal.nextTickPrice &&
        !zeroForOne
      ) {
        cache.nearestPriceCached = cache.currentPrice - 1n;
      } else {
        cache.nearestPriceCached = cache.currentPrice;
      }

      if (swapLocal.cross) {
        const limitOrderLiquidity = zeroForOne
          ? poolState.limitOrderTicks[Number(cache.nextTickToCross)]
              .token1Liquidity
          : poolState.limitOrderTicks[Number(cache.nextTickToCross)]
              .token0Liquidity;
        if (limitOrderLiquidity != 0n) {
          const response: StructHelper['ExecuteLimitResponse'] =
            SwapExecuter._executeLimitOrder(
              {
                sqrtpriceX96: swapLocal.nextTickPrice,
                tick: cache.nextTickToCross,
                zeroForOne: zeroForOne,
                amountIn: cache.amountIn,
                amountOut: cache.amountOut,
                limitOrderAmountOut: cache.limitOrderAmountOut,
                limitOrderAmountIn: cache.limitOrderAmountIn,
                cross: swapLocal.cross,
                token0LimitOrderFee: cache.token0LimitOrderFee,
                token1LimitOrderFee: cache.token1LimitOrderFee,
                exactIn: cache.exactIn,
                limitOrderFee: poolState.limitOrderFee,
              },
              poolState.limitOrderTicks,
              limitOrderLiquidity,
            );
          // Set the state of cache and other variables in scope
          cache.amountIn = response.amountIn;
          cache.amountOut = response.amountOut;
          swapLocal.cross = response.cross;
          cache.token0LimitOrderFee = response.token0LimitOrderFee;
          cache.token1LimitOrderFee = response.token1LimitOrderFee;
          cache.limitOrderAmountOut = response.limitOrderAmountOut;
          cache.limitOrderAmountIn = response.limitOrderAmountIn;

          // reset amountIn and amountOut and update totalAmount
          cache.totalAmount += cache.exactIn ? cache.amountOut : cache.amountIn;
          [cache.amountOut, cache.amountIn] = cache.exactIn
            ? [0n, cache.amountIn]
            : [cache.amountOut, 0n];
        }
        if (swapLocal.cross) {
          [cache.currentLiquidity, cache.nextTickToCross] = Ticks.cross(
            poolState.ticks,
            {
              nextTickToCross: cache.nextTickToCross,
              currentLiquidity: cache.currentLiquidity,
            },
            poolState.secondsGrowthGlobal,
            cache.feeGrowthGlobalA,
            cache.feeGrowthGlobalB,
            zeroForOne,
            poolState.tickSpacing,
          );
        } else {
          cache.nearestPriceCached = zeroForOne
            ? cache.currentPrice + 1n
            : cache.currentPrice - 1n;
        }
      }
    }
    poolState.price = cache.currentPrice;
    poolState.nearestPrice = cache.nearestPriceCached;
    //const newNearestTick = zeroForOne ? cache.nextTickToCross : poolState.ticks[Number(cache.nextTickToCross)].previousTick;
    poolState.token0LimitOrderFee = cache.token0LimitOrderFee;
    poolState.token1LimitOrderFee = cache.token1LimitOrderFee;
    if (slot0Start.tick !== newTick) {
      poolState.slot0.tick = newTick;
      // poolState.liquidity = BigInt(cache.currentLiquidity);
    }
    if (poolState.liquidity !== newLiquidity) {
      poolState.liquidity = newLiquidity;
    }
  }

  private _blockTimestamp(state: DeepReadonly<PoolState>) {
    return BigInt.asUintN(32, state.blockTimestamp);
  }
}

export const dfynV2Math = new DfynV2Math();
