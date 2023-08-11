import _ from 'lodash';
import { NumberAsString, SwapSide } from '@paraswap/core';
import { DeepReadonly } from 'ts-essentials';
import {
  LinkedlistData,
  OutputResult,
  PoolData,
  PoolState,
  TickInfo,
} from '../types';
import { TickMath } from './TickMath';
import { bigIntify, _require } from '../../../utils';
import { FEE_UNITS, MAX_TICK_DISTANCE, TWO_POW_96, ZERO } from '../constants';
import { SwapMath } from './SwapMath';
import { FullMath } from './FullMath';
import { ReinvestmentMath } from './ReinvestmentMath';
import { LiqDeltaMath } from './LiqDeltaMath';
import { SqrtPriceMath } from './SqrtPriceMath';
import { LiquidityMath } from './LiquidityMath';

type SwapDataState = {
  specifiedAmount: bigint;
  returnedAmount: bigint;
  sqrtP: bigint;
  currentTick: bigint;
  nextTick: bigint;
  nextSqrtP: bigint;
  isToken0: boolean;
  isExactInput: boolean;
  baseL: bigint;
  reinvestL: bigint;
  startSqrtP: bigint;
  nearestCurrentTick: bigint;
  reinvestLLast: bigint;
  feeGrowthGlobal: bigint;
  secondsPerLiquidityGlobal: bigint;
  secondsPerLiquidityUpdateTime: bigint;
  rTokenSupply: bigint;
  governmentFeeUnits: bigint;
  governmentFee: bigint;
  lpFee: bigint;
  blockTimestamp: bigint;
  isFirstCycleState: boolean;
  tickCount: bigint;
};

type ModifyPositionParams = {
  tickLower: bigint;
  tickUpper: bigint;
  liquidityDelta: bigint;
};

function _updateStateObject<T extends SwapDataState>(toUpdate: T, updateBy: T) {
  for (const k of Object.keys(updateBy) as (keyof T)[]) {
    toUpdate[k] = updateBy[k];
  }
}
function _simulateSwap(
  poolState: DeepReadonly<PoolState>,
  ticksStartState: Record<NumberAsString, TickInfo>,
  poolData: PoolData,
  swapData: SwapDataState,
  isToken0: boolean,
): [
  SwapDataState,
  {
    latestFullCycleState: SwapDataState;
  },
] {
  const latestFullCycleState: SwapDataState = { ...swapData };

  if (swapData.tickCount == 0n) {
    swapData.tickCount = 1n;
  }

  // clone ticks states
  let ticksCopy = _.cloneDeep(ticksStartState);

  let i = 1;
  const willUpTick = swapData.isExactInput != isToken0;
  const limitSqrtP = !willUpTick
    ? TickMath.MIN_SQRT_RATIO + 1n
    : TickMath.MAX_SQRT_RATIO - 1n;
  _require(
    willUpTick
      ? limitSqrtP > swapData.sqrtP && limitSqrtP < TickMath.MAX_SQRT_RATIO
      : limitSqrtP < swapData.sqrtP && limitSqrtP > TickMath.MIN_SQRT_RATIO,
    'bad limit sqrtP',
  );

  while (swapData.specifiedAmount !== 0n && swapData.sqrtP !== limitSqrtP) {
    let tmpNextTick = swapData.nextTick;
    if (willUpTick && tmpNextTick > MAX_TICK_DISTANCE + swapData.currentTick) {
      tmpNextTick = MAX_TICK_DISTANCE + swapData.currentTick;
    } else if (
      !willUpTick &&
      tmpNextTick < swapData.currentTick - MAX_TICK_DISTANCE
    ) {
      tmpNextTick = swapData.currentTick - MAX_TICK_DISTANCE;
    }

    swapData.startSqrtP = swapData.sqrtP;
    swapData.nextSqrtP = TickMath.getSqrtRatioAtTick(tmpNextTick);

    let targetSqrtP = swapData.nextSqrtP;

    if (willUpTick == swapData.nextSqrtP > limitSqrtP) {
      targetSqrtP = limitSqrtP;
    }

    let usedAmount = 0n;
    let returnedAmount = 0n;
    let deltaL = 0n;

    const swapStepResult = SwapMath.computeSwapStep(
      BigInt(swapData.baseL + swapData.reinvestL),
      BigInt(swapData.sqrtP),
      BigInt(targetSqrtP),
      BigInt(poolState.swapFeeUnits),
      BigInt(swapData.specifiedAmount),
      swapData.isExactInput,
      swapData.isToken0,
    );

    swapData.sqrtP = swapStepResult.nextSqrtP;
    usedAmount = swapStepResult.usedAmount;
    returnedAmount = swapStepResult.returnedAmount;
    deltaL = swapStepResult.deltaL;

    swapData.specifiedAmount -= usedAmount;
    swapData.returnedAmount += returnedAmount;
    swapData.reinvestL += BigInt.asUintN(128, deltaL);

    if (swapData.sqrtP !== swapData.nextSqrtP) {
      if (swapData.sqrtP !== swapData.startSqrtP) {
        swapData.currentTick = TickMath.getTickAtSqrtRatio(swapData.sqrtP);
      }
      break;
    }

    swapData.currentTick = willUpTick ? tmpNextTick : tmpNextTick - 1n;

    if (tmpNextTick !== swapData.nextTick) continue;

    swapData.reinvestLLast = poolData.reinvestLLast;
    swapData.feeGrowthGlobal = poolData.feeGrowthGlobal;

    let secondsElapsed =
      swapData.blockTimestamp -
      bigIntify(swapData.secondsPerLiquidityUpdateTime);

    if (secondsElapsed > 0n) {
      swapData.secondsPerLiquidityUpdateTime = swapData.blockTimestamp;
      if (swapData.baseL > 0n) {
        swapData.secondsPerLiquidityGlobal += BigInt.asUintN(
          128,
          secondsElapsed << (96n / swapData.baseL),
        );
      }
    }

    _require(swapData.rTokenSupply > 0n, 'swapData.rTokenSupply > 0n');
    let rMintQty = ReinvestmentMath.calcrMintQty(
      swapData.reinvestL,
      swapData.reinvestLLast,
      swapData.baseL,
      swapData.rTokenSupply,
    );

    if (rMintQty != 0n) {
      swapData.rTokenSupply += rMintQty;
      let governmentFee = (rMintQty * swapData.governmentFeeUnits) / FEE_UNITS;
      swapData.governmentFee += governmentFee;

      let lpFee = rMintQty - governmentFee;
      swapData.lpFee += lpFee;

      swapData.feeGrowthGlobal += FullMath.mulDivFloor(
        lpFee,
        TWO_POW_96,
        swapData.baseL,
      );
    }

    swapData.reinvestLLast = swapData.reinvestL;

    let crossTickResult = _updateLiquidityAndCrossTick(
      ticksCopy,
      poolState.initializedTicks,
      swapData.nextTick,
      swapData.baseL,
      swapData.feeGrowthGlobal,
      swapData.secondsPerLiquidityGlobal,
      willUpTick,
    );

    swapData.baseL = crossTickResult.newLiquidity;
    swapData.nextTick = crossTickResult.newNextTick;
    ++i;
  }

  if (swapData.rTokenSupply != 0n) {
    // mint fee to government and LPs --> just increase r token supply

    swapData.rTokenSupply += swapData.governmentFee + swapData.lpFee; // minting increase total supply
  }

  // update pool data
  swapData.nearestCurrentTick =
    swapData.nextTick > swapData.currentTick
      ? bigIntify(
          poolState.initializedTicks[Number(swapData.nextTick)].previous,
        )
      : swapData.nextTick;

  if (swapData.specifiedAmount !== 0n) {
    _updateStateObject(latestFullCycleState, swapData);
  }

  if (i > 1) {
    latestFullCycleState.tickCount += bigIntify(i - 1);
  }
  if (swapData.specifiedAmount !== 0n) {
    swapData.specifiedAmount = 0n;
    swapData.returnedAmount = 0n;
  }

  return [swapData, { latestFullCycleState }];
}

function _updateLiquidityAndCrossTick(
  ticks: Record<NumberAsString, TickInfo>,
  initializedTicks: Record<NumberAsString, LinkedlistData>,
  nextTick: bigint,
  currentLiquidity: bigint,
  feeGrowthGlobal: bigint,
  secondsPerLiquidityGlobal: bigint,
  willTickUp: boolean,
): { newLiquidity: bigint; newNextTick: bigint } {
  let newLiquidity = 0n;
  let newNextTick = 0n;

  ticks[Number(nextTick)].feeGrowthOutside =
    feeGrowthGlobal - ticks[Number(nextTick)].feeGrowthOutside;
  ticks[Number(nextTick)].secondsPerLiquidityOutside =
    secondsPerLiquidityGlobal -
    ticks[Number(nextTick)].secondsPerLiquidityOutside;

  let liquidityNet = ticks[Number(nextTick)].liquidityNet;

  if (willTickUp) {
    newNextTick = bigIntify(initializedTicks[Number(nextTick)].next);
  } else {
    newNextTick = bigIntify(initializedTicks[Number(nextTick)].previous);
    liquidityNet = -liquidityNet;
  }
  newLiquidity = LiqDeltaMath.applyLiquidityDelta(
    currentLiquidity,
    liquidityNet >= 0
      ? BigInt.asUintN(128, liquidityNet)
      : BigInt.asUintN(128, liquidityNet * -1n),
    liquidityNet >= 0,
  );

  newLiquidity = BigInt.asUintN(128, newLiquidity);
  newNextTick = BigInt.asIntN(24, newNextTick);
  return { newLiquidity, newNextTick };
}

class KSElasticMath {
  queryOutputs(
    poolState: DeepReadonly<PoolState>,
    // Amounts must increase
    amounts: bigint[],
    isToken0: boolean,
    side: SwapSide,
  ): OutputResult {
    const poolData = poolState.poolData;

    let tickCopy = _.cloneDeep(poolState.ticks);

    const isSell = side === SwapSide.SELL;

    let isOutOfRange = false;
    let previousAmount = 0n;

    const outputs = new Array<bigint>(amounts.length);
    const tickCounts = new Array<number>(amounts.length);
    for (const [i, amount] of amounts.entries()) {
      if (amount === 0n) {
        outputs[i] = 0n;
        tickCounts[i] = 0;
        continue;
      }

      const amountSpecified = isSell
        ? BigInt.asIntN(256, amount)
        : -BigInt.asIntN(256, amount);

      let state: SwapDataState = this._getInitialSwapData(
        poolState,
        poolData,
        isToken0,
        amountSpecified,
      );
      state.isToken0 = isToken0;
      state.isExactInput = amountSpecified > 0;
      if (state.isFirstCycleState) {
        // Set first non zero amount
        state.specifiedAmount = amountSpecified;
        state.isFirstCycleState = false;
      } else {
        state.specifiedAmount =
          amountSpecified - (previousAmount - state.specifiedAmount);
      }

      if (!isOutOfRange) {
        const [finalState, { latestFullCycleState }] = _simulateSwap(
          poolState,
          tickCopy,
          poolData,
          state,
          isToken0,
        );
        if (
          finalState.specifiedAmount === 0n &&
          finalState.returnedAmount === 0n
        ) {
          isOutOfRange = true;
          outputs[i] = 0n;
          tickCounts[i] = 0;
          continue;
        }

        // We use it on next step to correct state.amountSpecifiedRemaining
        previousAmount = amountSpecified;

        // First extract calculated values
        const [deltaQty0, deltaQty1] = isToken0
          ? [
              amountSpecified - finalState.specifiedAmount,
              finalState.returnedAmount,
            ]
          : [
              finalState.returnedAmount,
              amountSpecified - finalState.specifiedAmount,
            ];

        // Update for next amount
        _updateStateObject(state, latestFullCycleState);
        if (isSell) {
          outputs[i] = BigInt.asUintN(256, -(isToken0 ? deltaQty1 : deltaQty0));
          tickCounts[i] = Number(latestFullCycleState.tickCount);
          continue;
        } else {
          outputs[i] = isToken0
            ? BigInt.asUintN(256, deltaQty1)
            : BigInt.asUintN(256, deltaQty0);
          tickCounts[i] = Number(latestFullCycleState.tickCount);
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

  // swapFromEvent(
  //   poolState: PoolState,
  //   amountSpecified: bigint,
  //   newSqrtPriceX96: bigint,
  //   newTick: bigint,
  //   newLiquidity: bigint,
  //   zeroForOne: boolean,
  // ): bigint {
  //   const cache = {
  //     liquidityStart: poolState.poolData.baseL,
  //     feeProtocol: 0n,
  //     secondsPerLiquidityCumulativeX128: 0n,
  //     tickCumulative: 0n,
  //     computedLatestObservation: false,
  //   };

  //   const state = {
  //     // Because I don't have the exact amount user used, set this number to MAX_NUMBER to proceed
  //     // with calculations. I think it is not a problem since in loop I don't rely on this value
  //     amountSpecifiedRemaining: amountSpecified,
  //     amountCalculated: 0n,
  //     sqrtPriceX96: poolState.poolData.sqrtP,
  //     tick: poolState.currentTick,
  //     protocolFee: 0n,
  //     liquidity: cache.liquidityStart,
  //     reinvestL: poolState.reinvestLiquidity,
  //     fee: poolState.swapFeeUnits,
  //     tickList: tickList,
  //   };
  //   const exactInput = amountSpecified >= ZERO;

  //   // Because I didn't have all variables, adapted loop stop with state.tick !== newTick
  //   // condition. This cycle need only to calculate Tick.cross() function values
  //   // It means that we are interested in cycling only if state.tick !== newTick
  //   // When they become equivalent, we proceed with state updating part as normal
  //   // And if assumptions regarding this cycle are correct, we don't need to process
  //   // the last cycle when state.tick === newTick
  //   while (state.tick !== newTick && state.sqrtPriceX96 !== newSqrtPriceX96) {
  //     const step = {
  //       sqrtPriceStartX96: 0n,
  //       tickNext: 0n,
  //       initialized: false,
  //       sqrtPriceNextX96: 0n,
  //       amountIn: 0n,
  //       amountOut: 0n,
  //       feeAmount: 0n,
  //       deltaL: 0n,
  //     };

  //     step.sqrtPriceStartX96 = state.sqrtPriceX96;

  //     const result = TickList.nextInitializedTickWithinFixedDistance(
  //       state.tickList,
  //       Number(state.tick),
  //       zeroForOne,
  //       480,
  //     );

  //     step.tickNext = BigInt(result[0]);
  //     step.initialized = result[1];

  //     if (step.tickNext < TickMath.MIN_TICK) {
  //       step.tickNext = TickMath.MIN_TICK;
  //     } else if (step.tickNext > TickMath.MAX_TICK) {
  //       step.tickNext = TickMath.MAX_TICK;
  //     }

  //     step.sqrtPriceNextX96 = TickMath.getSqrtRatioAtTick(step.tickNext);

  //     const stepRs = SwapMath.computeSwapStep(
  //       state.sqrtPriceX96,
  //       (
  //         zeroForOne
  //           ? step.sqrtPriceNextX96 < newSqrtPriceX96
  //           : step.sqrtPriceNextX96 > newSqrtPriceX96
  //       )
  //         ? newSqrtPriceX96
  //         : step.sqrtPriceNextX96,
  //       state.liquidity + state.reinvestL,
  //       state.amountSpecifiedRemaining,
  //       poolState.swapFeeUnits,
  //       exactInput,
  //       zeroForOne,
  //     );
  //     step.amountIn = stepRs.usedAmount;
  //     step.amountOut = stepRs.returnedAmount;
  //     step.deltaL = stepRs.deltaL;
  //     state.sqrtPriceX96 = stepRs.nextSqrtP;

  //     state.amountSpecifiedRemaining =
  //       state.amountSpecifiedRemaining - step.amountIn;
  //     state.amountCalculated = state.amountCalculated + step.amountOut;
  //     state.reinvestL = state.reinvestL + step.deltaL;
  //     if (state.sqrtPriceX96 == step.sqrtPriceNextX96) {
  //       if (step.initialized) {
  //         let liquidityNet = TickList.getTick(
  //           state.tickList,
  //           Number(step.tickNext),
  //         ).liquidityNet;
  //         if (zeroForOne) liquidityNet = -liquidityNet;
  //         state.liquidity = LiquidityMath.addDelta(
  //           state.liquidity,
  //           liquidityNet,
  //         );
  //       }

  //       state.tick = zeroForOne ? step.tickNext - 1n : step.tickNext;
  //     } else if (state.sqrtPriceX96 != step.sqrtPriceStartX96) {
  //       state.tick = TickMath.getTickAtSqrtRatio(state.sqrtPriceX96);
  //     }
  //   }

  //   if (poolState.currentTick !== newTick) {
  //     [poolState.poolData.sqrtP, poolState.currentTick] = [
  //       newSqrtPriceX96,
  //       newTick,
  //     ];
  //   } else {
  //     poolState.poolData.sqrtP = newSqrtPriceX96;
  //   }

  //   if (poolState.poolData.baseL !== newLiquidity)
  //     poolState.poolData.baseL = newLiquidity;
  //   return state.amountCalculated;
  // }

  modifyPosition(
    state: PoolState,
    params: ModifyPositionParams,
  ): [bigint, bigint] {
    this._checkTicks(params.tickLower, params.tickUpper);

    let amount0 = 0n;
    let amount1 = 0n;
    if (params.liquidityDelta !== 0n) {
      if (state.currentTick < params.tickLower) {
        amount0 = SqrtPriceMath._getAmount0DeltaO(
          TickMath.getSqrtRatioAtTick(params.tickLower),
          TickMath.getSqrtRatioAtTick(params.tickUpper),
          params.liquidityDelta,
        );
      } else if (state.currentTick < params.tickUpper) {
        const liquidityBefore = state.poolData.baseL;

        amount0 = SqrtPriceMath._getAmount0DeltaO(
          state.poolData.sqrtP,
          TickMath.getSqrtRatioAtTick(params.tickUpper),
          params.liquidityDelta,
        );
        amount1 = SqrtPriceMath._getAmount1DeltaO(
          TickMath.getSqrtRatioAtTick(params.tickLower),
          state.poolData.sqrtP,
          params.liquidityDelta,
        );

        state.poolData.baseL = LiquidityMath.addDelta(
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

  private _getInitialSwapData(
    state: PoolState,
    poolData: PoolData,
    isToken0: boolean,
    amountSpecified: bigint,
  ): SwapDataState {
    let isExactInput = amountSpecified > 0n;
    let willTickUp = isExactInput != isToken0;
    const initState: SwapDataState = {
      ...poolData,
      ...state,
      currentTick: bigIntify(poolData.currentTick),
      nearestCurrentTick: bigIntify(poolData.nearestCurrentTick),
      nextTick: !willTickUp
        ? bigIntify(poolData.nearestCurrentTick)
        : bigIntify(
            state.initializedTicks[Number(poolData.nearestCurrentTick)].next,
          ),
      specifiedAmount: 0n,
      returnedAmount: 0n,
      startSqrtP: poolData.sqrtP,
      isToken0: isToken0,
      isExactInput: isExactInput,
      nextSqrtP: 0n,
      isFirstCycleState: true,
      tickCount: 0n,
      feeGrowthGlobal: 0n,
      governmentFee: 0n,
      governmentFeeUnits: state.swapFeeUnits,
      lpFee: 0n,
    };
    return initState;
  }

  private _checkTicks(tickLower: bigint, tickUpper: bigint) {
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
}

export const ksElasticMath = new KSElasticMath();
