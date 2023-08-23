import _, { partialRight } from 'lodash';
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
import {
  FEE_UNITS,
  MAX_TICK_DISTANCE,
  MAX_TICK_TRAVEL,
  TWO_POW_96,
  ZERO,
} from '../constants';
import { SwapMath } from './SwapMath';
import { FullMath } from './FullMath';
import { ReinvestmentMath } from './ReinvestmentMath';
import { LiqDeltaMath } from './LiqDeltaMath';
import { SqrtPriceMath } from './SqrtPriceMath';
import { LiquidityMath } from './LiquidityMath';
import { SafeCast } from './SafeCast';
import { BI_MAX_INT } from '../../../bigint-constants';
import { LinkedList } from './TickLinkedList';
import { QtyDeltaMath } from './QtyDeltaMath';

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

type UpdatePositionData = {
  tickLower: bigint;
  tickUpper: bigint;
  tickLowerPrevious: bigint;
  tickUpperPrevious: bigint;
  liqDelta: bigint;
};

type ModifyPositionParams = {
  tickLower: bigint;
  tickUpper: bigint;
  liquidityDelta: bigint;
};

type BurnRTokenParams = {
  qty: bigint;
  isLogicalBurn: boolean;
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
          (secondsElapsed << 96n) / swapData.baseL,
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
      let governmentFee = (rMintQty * poolState.governmentFeeUnits) / FEE_UNITS;
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
      : SafeCast.revToUint128(liquidityNet),
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

  swapFromEvent(
    poolState: PoolState,
    specifiedAmount: bigint,
    returnedAmount: bigint,
    newSqrtP: bigint,
    newTick: bigint,
    newLiquidity: bigint,
    isToken0: boolean,
  ): void {
    let isExactInput = specifiedAmount > 0n;
    let willTickUp: boolean = isExactInput != isToken0;

    const swapData = {
      baseL: poolState.poolData.baseL,
      reinvestL: poolState.poolData.reinvestL,
      sqrtP: poolState.poolData.sqrtP,
      currentTick: poolState.poolData.currentTick,
      nextTick: !willTickUp
        ? poolState.poolData.nearestCurrentTick
        : poolState.initializedTicks[
            Number(poolState.poolData.nearestCurrentTick)
          ].next,
      specifiedAmount: specifiedAmount,
      isToken0: isToken0,
      isExactInput: isExactInput,
      returnedAmount: 0n,
      nextSqrtP: 0n,
      startSqrtP: 0n,
    };
    let swapCache = {
      rTotalSupply: 0n,
      reinvestLLast: 0n,
      feeGrowthGlobal: 0n,
      secondsPerLiquidityGlobal: 0n,
      governmentFeeUnits: 0n,
      governmentFee: 0n,
      lpFee: 0n,
    };
    while (swapData.specifiedAmount != 0n) {
      let tempNextTick = swapData.nextTick;
      if (
        willTickUp &&
        tempNextTick > MAX_TICK_DISTANCE + swapData.currentTick
      ) {
        tempNextTick = swapData.currentTick + MAX_TICK_DISTANCE;
      } else if (
        !willTickUp &&
        tempNextTick < swapData.currentTick - MAX_TICK_DISTANCE
      ) {
        tempNextTick = swapData.currentTick - MAX_TICK_DISTANCE;
      }

      swapData.startSqrtP = swapData.sqrtP;
      swapData.nextSqrtP = TickMath.getSqrtRatioAtTick(tempNextTick);

      let targetSqrtP = swapData.nextSqrtP;
      if (willTickUp == swapData.nextSqrtP > newSqrtP) {
        targetSqrtP = newSqrtP;
      }

      let computeSwapResult = SwapMath.computeSwapStep(
        BigInt(swapData.baseL + swapData.reinvestL),
        BigInt(swapData.sqrtP),
        BigInt(targetSqrtP),
        BigInt(poolState.swapFeeUnits),
        BigInt(swapData.specifiedAmount),
        swapData.isExactInput,
        swapData.isToken0,
        true,
      );

      swapData.specifiedAmount -= computeSwapResult.usedAmount;
      swapData.returnedAmount += computeSwapResult.returnedAmount;
      swapData.reinvestL += BigInt.asUintN(128, computeSwapResult.deltaL);
      swapData.sqrtP = computeSwapResult.nextSqrtP;

      if (swapData.sqrtP != swapData.nextSqrtP) {
        if (swapData.sqrtP != swapData.startSqrtP) {
          swapData.currentTick = TickMath.getTickAtSqrtRatio(swapData.sqrtP);
        }
        break;
      }

      swapData.currentTick = willTickUp ? tempNextTick : tempNextTick - 1n;

      if (tempNextTick != swapData.nextTick) continue;

      if (swapCache.rTotalSupply == 0n) {
        swapCache.rTotalSupply = poolState.poolData.rTokenSupply;
        swapCache.reinvestLLast = poolState.poolData.reinvestLLast;
        swapCache.feeGrowthGlobal = poolState.poolData.feeGrowthGlobal;
        this._syncSecondsPerLiq(poolState);
        swapCache.secondsPerLiquidityGlobal =
          poolState.poolData.secondsPerLiquidityGlobal;

        swapCache.governmentFeeUnits = poolState.governmentFeeUnits;
      }

      let rMintQty = ReinvestmentMath.calcrMintQty(
        swapData.reinvestL,
        swapCache.reinvestLLast,
        swapData.baseL,
        swapCache.rTotalSupply,
      );

      if (rMintQty != 0n) {
        swapCache.rTotalSupply += rMintQty;

        let governmentFee =
          (rMintQty * swapCache.governmentFeeUnits) / FEE_UNITS;
        swapCache.governmentFee += governmentFee;

        let lpFee = rMintQty - governmentFee;
        swapCache.lpFee += lpFee;

        swapCache.feeGrowthGlobal += FullMath.mulDivFloor(
          lpFee,
          TWO_POW_96,
          swapData.baseL,
        );
      }

      swapCache.reinvestLLast = swapData.reinvestL;

      let updateLiqRes = _updateLiquidityAndCrossTick(
        poolState.ticks,
        poolState.initializedTicks,
        swapData.nextTick,
        swapData.baseL,
        swapCache.feeGrowthGlobal,
        swapCache.secondsPerLiquidityGlobal,
        willTickUp,
      );

      swapData.baseL = updateLiqRes.newLiquidity;
      swapData.nextTick = updateLiqRes.newNextTick;
    }

    if (swapCache.rTotalSupply != 0n) {
      poolState.poolData.rTokenSupply +=
        swapCache.governmentFee + swapCache.lpFee;

      poolState.poolData.reinvestLLast = swapCache.reinvestLLast;
      poolState.poolData.feeGrowthGlobal = swapCache.feeGrowthGlobal;
    }

    poolState.poolData.baseL = swapData.baseL;
    poolState.poolData.reinvestL = swapData.reinvestL;
    poolState.poolData.sqrtP = swapData.sqrtP;
    poolState.poolData.currentTick = swapData.currentTick;
    poolState.poolData.nearestCurrentTick =
      swapData.nextTick > swapData.currentTick
        ? poolState.initializedTicks[Number(swapData.nextTick)].previous
        : swapData.nextTick;
    poolState.reinvestLiquidity = swapData.reinvestL;

    [
      poolState.poolData.sqrtP,
      poolState.currentTick,
      poolState.poolData.baseL,
    ] = [newSqrtP, newTick, newLiquidity];
  }

  burnRToken(state: PoolState, params: BurnRTokenParams): void {
    if (params.isLogicalBurn) {
      state.poolData.rTokenSupply -= params.qty;
      return;
    }

    let reinvestL = state.poolData.reinvestL;
    this._syncFeeGrowth(state, false);

    let deltaL = FullMath.mulDivFloor(
      params.qty,
      reinvestL,
      state.poolData.rTokenSupply,
    );
    reinvestL -= BigInt.asUintN(128, deltaL);
    state.poolData.reinvestL = reinvestL;
    state.poolData.reinvestLLast = reinvestL;
    state.poolData.rTokenSupply -= params.qty;
    state.reinvestLiquidity = reinvestL;
  }

  tweakPosZeroLiq(state: PoolState): void {
    this._syncFeeGrowth(state, true);

    this._syncSecondsPerLiq(state);
  }

  modifyPosition(
    state: PoolState,
    params: ModifyPositionParams,
  ): [bigint, bigint] {
    this._checkTicks(params.tickLower, params.tickUpper);

    const isBurn = params.liquidityDelta < 0n;

    let initTicksSorted = Object.keys(state.initializedTicks)
      .map(bigIntify)
      .sort();

    // sync fee growth
    this._syncFeeGrowth(state, true);
    // sync seconds per liq
    this._syncSecondsPerLiq(state);

    this._updatePosition(state, state.poolData.currentTick, {
      liqDelta: params.liquidityDelta,
      tickLower: params.tickLower,
      tickUpper: params.tickUpper,
      tickLowerPrevious: isBurn
        ? 0n
        : bigIntify(initTicksSorted.find(e => e <= params.tickLower)),
      tickUpperPrevious: isBurn
        ? 0n
        : bigIntify(initTicksSorted.find(e => e <= params.tickUpper)),
    });

    let amount0 = 0n;
    let amount1 = 0n;
    if (params.liquidityDelta !== 0n) {
      if (state.currentTick < params.tickLower) {
        amount0 = QtyDeltaMath.calcRequiredQty0(
          TickMath.getSqrtRatioAtTick(params.tickLower),
          TickMath.getSqrtRatioAtTick(params.tickUpper),
          params.liquidityDelta,
          params.liquidityDelta > 0n,
        );
      } else if (state.currentTick < params.tickUpper) {
        const liquidityBefore = state.poolData.baseL;

        amount0 = QtyDeltaMath.calcRequiredQty0(
          state.poolData.sqrtP,
          TickMath.getSqrtRatioAtTick(params.tickUpper),
          params.liquidityDelta,
          params.liquidityDelta > 0n,
        );
        amount1 = QtyDeltaMath.calcRequiredQty1(
          TickMath.getSqrtRatioAtTick(params.tickLower),
          state.poolData.sqrtP,
          params.liquidityDelta,
          params.liquidityDelta > 0n,
        );
        state.poolData.baseL = LiqDeltaMath.applyLiquidityDelta(
          liquidityBefore,
          params.liquidityDelta > 0n
            ? params.liquidityDelta
            : -params.liquidityDelta,
          params.liquidityDelta > 0n,
        );
      } else {
        amount1 = QtyDeltaMath.calcRequiredQty1(
          TickMath.getSqrtRatioAtTick(params.tickLower),
          TickMath.getSqrtRatioAtTick(params.tickUpper),
          params.liquidityDelta,
          params.liquidityDelta > 0n,
        );
      }
    }
    return [amount0, amount1];
  }

  private _syncFeeGrowth(state: PoolState, updateReinvestLLast: boolean) {
    let rMintQty: bigint = ReinvestmentMath.calcrMintQty(
      state.poolData.reinvestL,
      state.poolData.reinvestLLast,
      state.poolData.baseL,
      state.poolData.rTokenSupply,
    );

    if (rMintQty != 0n) {
      // rtoken minted

      state.poolData.rTokenSupply += rMintQty;

      const govtFee: bigint = (rMintQty * state.governmentFeeUnits) / FEE_UNITS;

      rMintQty -= govtFee;

      state.poolData.feeGrowthGlobal += FullMath.mulDivFloor(
        rMintQty,
        TWO_POW_96,
        state.poolData.baseL,
      );
    }
    if (updateReinvestLLast) {
      state.poolData.reinvestLLast = state.poolData.reinvestL;
    }
  }

  private _syncSecondsPerLiq(state: PoolState) {
    let secondsElapsed: bigint =
      state.blockTimestamp - state.poolData.secondsPerLiquidityUpdateTime;

    if (secondsElapsed > 0n) {
      state.poolData.secondsPerLiquidityUpdateTime = state.blockTimestamp;
      if (state.poolData.baseL > 0n) {
        state.poolData.secondsPerLiquidityGlobal += BigInt.asUintN(
          128,
          (secondsElapsed << 96n) / state.poolData.baseL,
        );
      }
    }
  }

  private _updatePosition(
    state: PoolState,
    currentTick: bigint,
    params: UpdatePositionData,
  ) {
    this._updateTick(
      state,
      params.tickLower,
      currentTick,
      params.tickLowerPrevious,
      params.liqDelta,
      true,
    );

    this._updateTick(
      state,
      params.tickUpper,
      currentTick,
      params.tickUpperPrevious,
      params.liqDelta,
      false,
    );
  }

  private _updateTick(
    state: PoolState,
    tick: bigint,
    tickCurrent: bigint,
    tickPrevious: bigint,
    liqDelta: bigint,
    isLower: boolean,
  ) {
    if (liqDelta != 0n) {
      if (!(Number(tick) in state.ticks)) {
        state.ticks[Number(tick)] = {
          feeGrowthOutside: 0n,
          liquidityGross: 0n,
          liquidityNet: 0n,
          secondsPerLiquidityOutside: 0n,
        };
      }

      let liqGrossBefore: bigint = state.ticks[Number(tick)].liquidityGross;

      _require(liqGrossBefore != 0n || liqDelta != 0n, 'invalid liq');
      let liqGrossAfter = LiqDeltaMath.applyLiquidityDelta(
        liqGrossBefore,
        liqDelta > 0n ? liqDelta : -liqDelta,
        liqDelta > 0n,
      );

      let liqNetAfter = isLower
        ? state.ticks[Number(tick)].liquidityNet + liqDelta
        : state.ticks[Number(tick)].liquidityNet - liqDelta;

      if (liqGrossBefore == 0n) {
        if (tick <= tickCurrent) {
          state.ticks[Number(tick)].feeGrowthOutside =
            state.poolData.feeGrowthGlobal;
          state.ticks[Number(tick)].secondsPerLiquidityOutside =
            state.poolData.secondsPerLiquidityGlobal;
        }
      }

      state.ticks[Number(tick)].liquidityGross = liqGrossAfter;
      state.ticks[Number(tick)].liquidityNet = liqNetAfter;

      if (liqGrossBefore > 0n && liqGrossAfter == 0n) {
        // remove tick
        if (Number(tick) in state.ticks) {
          delete state.ticks[Number(tick)];
        }
      }

      if (liqGrossBefore > 0n != liqGrossAfter > 0n) {
        // update tick list
        this._updateTickList(
          state,
          tick,
          tickPrevious,
          tickCurrent,
          liqDelta > 0n,
        );
      }
    }
  }

  private _updateTickList(
    state: PoolState,
    tick: bigint,
    previousTick: bigint,
    currentTick: bigint,
    isAdd: boolean,
  ) {
    if (isAdd) {
      if (tick == TickMath.MIN_TICK || tick == TickMath.MAX_TICK) return;
      let nextTick = state.initializedTicks[Number(previousTick)].next;
      let i = 0n;
      while (nextTick <= tick && i < MAX_TICK_TRAVEL) {
        previousTick = nextTick;
        nextTick = state.initializedTicks[Number(previousTick)].next;
        i++;
      }
      LinkedList.insert(state.initializedTicks, tick, previousTick, nextTick);
      if (state.poolData.nearestCurrentTick < tick && tick <= currentTick) {
        state.poolData.nearestCurrentTick = tick;
      }
    } else {
      if (tick == state.poolData.nearestCurrentTick) {
        state.poolData.nearestCurrentTick = LinkedList.remove(
          state.initializedTicks,
          tick,
        );
      } else {
        LinkedList.remove(state.initializedTicks, tick);
      }
    }
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
