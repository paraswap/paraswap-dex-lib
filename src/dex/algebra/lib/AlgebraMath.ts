import { DeepReadonly } from 'ts-essentials';
import { PoolState } from '../types';
import { NumberAsString, SwapSide } from '@paraswap/core';
import { OutputResult, TickInfo } from '../../uniswap-v3/types';
import { Tick } from '../../uniswap-v3/contract-math/Tick';
import { TickBitMap } from '../../uniswap-v3/contract-math/TickBitMap';
import { SqrtPriceMath } from '../../uniswap-v3/contract-math/SqrtPriceMath';
import { TickMath } from '../../uniswap-v3/contract-math/TickMath';
import { LiquidityMath } from '../../uniswap-v3/contract-math/LiquidityMath';
import { _require, int256, uint32 } from '../../../utils';
import { DataStorageOperator } from './DataStorageOperator';
import { SwapMath } from '../../uniswap-v3/contract-math/SwapMath';
import { Constants } from './Constants';
import { BI_MAX_INT } from '../../../bigint-constants';
import _ from 'lodash';
import {
  PriceComputationCache,
  PriceComputationState,
  _updatePriceComputationObjects,
} from '../../uniswap-v3/contract-math/uniswap-v3-math';
import {
  MAX_PRICING_COMPUTATION_STEPS_ALLOWED,
  OUT_OF_RANGE_ERROR_POSTFIX,
} from '../../uniswap-v3/constants';
import { Logger } from '../../../types';

type UpdatePositionCache = {
  price: bigint;
  tick: bigint;
  timepointIndex: bigint;
};

enum Status {
  NOT_EXIST,
  ACTIVE,
  NOT_STARTED,
}

interface SwapCalculationCache {
  communityFee: bigint; // The community fee of the selling token, uint256 to minimize casts
  //volumePerLiquidityInBlock: bigint;
  tickCumulative: bigint; // The global tickCumulative at the moment
  secondsPerLiquidityCumulative: bigint; // The global secondPerLiquidity at the moment
  computedLatestTimepoint: boolean; //  if we have already fetched _tickCumulative_ and _secondPerLiquidity_ from the DataOperator
  amountRequiredInitial: bigint; // The initial value of the exact input\output amount
  amountCalculated: bigint; // The additive amount of total output\input calculated trough the swap
  incentiveStatus: Status; // If there is an active incentive at the moment
  exactInput: boolean; // Whether the exact input or output is specified
  fee: bigint; // The current dynamic fee
  startTick: bigint; // The tick at the start of a swap
  timepointIndex: bigint; // The index of last written timepoint
  isFirstCycleState: boolean;
}

interface PriceMovementCache {
  stepSqrtPrice: bigint; // The Q64.96 sqrt of the price at the start of the step
  nextTick: bigint; // The tick till the current step goes
  initialized: boolean; // True if the _nextTick is initialized
  nextTickPrice: bigint; // The Q64.96 sqrt of the price calculated from the _nextTick
  input: bigint; // The additive amount of tokens that have been provided
  output: bigint; // The additive amount of token that have been withdrawn
  feeAmount: bigint; // The total amount of fee earned within a current step
  tickCount: number;
}

// % START OF COPY PASTA FROM UNISWAPV3 %
function _priceComputationCycles(
  poolState: DeepReadonly<PoolState>,
  ticksCopy: Record<NumberAsString, TickInfo>,
  globalState: PoolState['globalState'],
  state: PriceComputationState,
  cache: PriceComputationCache,
  sqrtPriceLimitX96: bigint,
  zeroForOne: boolean,
  exactInput: boolean,
): [
  // result
  PriceComputationState,
  // Latest calculated full cycle state we can use for bigger amounts
  {
    latestFullCycleState: PriceComputationState;
    latestFullCycleCache: PriceComputationCache;
  },
] {
  const latestFullCycleState: PriceComputationState = { ...state };

  if (cache.tickCount == 0) {
    cache.tickCount = 1;
  }
  const latestFullCycleCache: PriceComputationCache = { ...cache };

  // We save tick before any change. Later we use this to restore
  // state before last step
  let lastTicksCopy: { index: number; tick: TickInfo } | undefined;

  let i = 0;
  for (
    ;
    state.amountSpecifiedRemaining !== 0n &&
    state.sqrtPriceX96 !== sqrtPriceLimitX96;
    ++i
  ) {
    if (
      latestFullCycleCache.tickCount + i >
      MAX_PRICING_COMPUTATION_STEPS_ALLOWED
    ) {
      state.amountSpecifiedRemaining = 0n;
      state.amountCalculated = 0n;
      break;
    }

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

    try {
      [step.tickNext, step.initialized] =
        TickBitMap.nextInitializedTickWithinOneWord(
          poolState,
          state.tick,
          poolState.tickSpacing,
          zeroForOne,
          true,
        );
    } catch (e) {
      if (
        e instanceof Error &&
        e.message.endsWith(OUT_OF_RANGE_ERROR_POSTFIX)
      ) {
        state.amountSpecifiedRemaining = 0n;
        state.amountCalculated = 0n;
        break;
      }
      throw e;
    }

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
      poolState.globalState.fee,
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

    if (state.sqrtPriceX96 === step.sqrtPriceNextX96) {
      if (step.initialized) {
        if (!cache.computedLatestObservation) {
          // [cache.tickCumulative, cache.secondsPerLiquidityCumulativeX128] =
          //   Oracle.observeSingle(
          //     poolState,
          //     cache.blockTimestamp,
          //     0n,
          //     slot0Start.tick,
          //     slot0Start.observationIndex,
          //     cache.liquidityStart,
          //     slot0Start.observationCardinality,
          //   );

          [cache.tickCumulative, cache.secondsPerLiquidityCumulativeX128] =
            DataStorageOperator.getSingleTimepoint(
              poolState,
              cache.blockTimestamp,
              0n,
              globalState.tick,
              globalState.timepointIndex,
              cache.liquidityStart,
            );
          cache.computedLatestObservation = true;
        }

        if (state.amountSpecifiedRemaining === 0n) {
          const castTickNext = Number(step.tickNext);
          lastTicksCopy = {
            index: castTickNext,
            tick: { ...ticksCopy[castTickNext] },
          };
        }

        let liquidityNet = Tick.cross(
          ticksCopy,
          step.tickNext,
          cache.secondsPerLiquidityCumulativeX128,
          cache.tickCumulative,
          cache.blockTimestamp,
        );
        if (zeroForOne) liquidityNet = -liquidityNet;

        state.liquidity = LiquidityMath.addDelta(state.liquidity, liquidityNet);
      }

      state.tick = zeroForOne ? step.tickNext - 1n : step.tickNext;
    } else if (state.sqrtPriceX96 != step.sqrtPriceStartX96) {
      state.tick = TickMath.getTickAtSqrtRatio(state.sqrtPriceX96);
    }

    if (state.amountSpecifiedRemaining !== 0n) {
      _updatePriceComputationObjects(latestFullCycleState, state);
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

  if (state.amountSpecifiedRemaining !== 0n) {
    state.amountSpecifiedRemaining = 0n;
    state.amountCalculated = 0n;
  }

  return [state, { latestFullCycleState, latestFullCycleCache }];
}

class AlgebraMathClass {
  queryOutputs(
    poolState: DeepReadonly<PoolState>,
    amounts: bigint[],
    zeroForOne: boolean,
    side: SwapSide,
  ): OutputResult {
    const slot0Start = poolState.globalState;

    const isSell = side === SwapSide.SELL;

    // While calculating, ticks are changing, so to not change the actual state,
    // we use copy
    const ticksCopy = _.cloneDeep(poolState.ticks);

    const sqrtPriceLimitX96 = zeroForOne
      ? TickMath.MIN_SQRT_RATIO + 1n
      : TickMath.MAX_SQRT_RATIO - 1n;

    const cache: PriceComputationCache = {
      liquidityStart: poolState.liquidity,
      blockTimestamp: this._blockTimestamp(poolState),
      feeProtocol: zeroForOne
        ? slot0Start.communityFeeToken0 % 16n
        : slot0Start.communityFeeToken1 >> 4n,
      secondsPerLiquidityCumulativeX128: 0n,
      tickCumulative: 0n,
      computedLatestObservation: false,
      tickCount: 0,
    };

    const state: PriceComputationState = {
      // Will be overwritten later
      amountSpecifiedRemaining: 0n,
      amountCalculated: 0n,
      sqrtPriceX96: slot0Start.price,
      tick: slot0Start.tick,
      protocolFee: 0n,
      liquidity: cache.liquidityStart,
      isFirstCycleState: true,
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

      if (state.isFirstCycleState) {
        // Set first non zero amount
        state.amountSpecifiedRemaining = amountSpecified;
        state.isFirstCycleState = false;
      } else {
        state.amountSpecifiedRemaining =
          amountSpecified - (previousAmount - state.amountSpecifiedRemaining);
      }

      const exactInput = amountSpecified > 0n;

      _require(
        zeroForOne
          ? sqrtPriceLimitX96 < slot0Start.price &&
              sqrtPriceLimitX96 > TickMath.MIN_SQRT_RATIO
          : sqrtPriceLimitX96 > slot0Start.price &&
              sqrtPriceLimitX96 < TickMath.MAX_SQRT_RATIO,
        'SPL',
        { zeroForOne, sqrtPriceLimitX96, slot0Start },
        'zeroForOne ? sqrtPriceLimitX96 < slot0Start.sqrtPriceX96 && sqrtPriceLimitX96 > TickMath.MIN_SQRT_RATIO : sqrtPriceLimitX96 > slot0Start.sqrtPriceX96 && sqrtPriceLimitX96 < TickMath.MAX_SQRT_RATIO',
      );

      if (!isOutOfRange) {
        const [finalState, { latestFullCycleState, latestFullCycleCache }] =
          _priceComputationCycles(
            poolState,
            ticksCopy,
            slot0Start,
            state,
            cache,
            sqrtPriceLimitX96,
            zeroForOne,
            exactInput,
          );
        if (
          finalState.amountSpecifiedRemaining === 0n &&
          finalState.amountCalculated === 0n
        ) {
          isOutOfRange = true;
          outputs[i] = 0n;
          tickCounts[i] = 0;
          continue;
        }

        // We use it on next step to correct state.amountSpecifiedRemaining
        previousAmount = amountSpecified;

        // First extract calculated values
        const [amount0, amount1] =
          zeroForOne === exactInput
            ? [
                amountSpecified - finalState.amountSpecifiedRemaining,
                finalState.amountCalculated,
              ]
            : [
                finalState.amountCalculated,
                amountSpecified - finalState.amountSpecifiedRemaining,
              ];

        // Update for next amount
        _updatePriceComputationObjects(state, latestFullCycleState);
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
  // % END OF COPY PASTA FROM UNISWAPV3 %

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
    const {
      globalState,
      liquidity,
      // volumePerLiquidityInBlock
    } = state;
    let toggledBottom: boolean = false;
    let toggledTop: boolean = false;
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
        DataStorageOperator.getSingleTimepoint(
          state,
          time,
          0n,
          cache.tick,
          cache.timepointIndex,
          liquidity,
        );
      if (
        Tick.update(
          state,
          bottomTick,
          cache.tick,
          liquidityDelta,
          secondsPerLiquidityCumulative,
          tickCumulative,
          time,
          false, // isTopTick,
          state.maxLiquidityPerTick,
        )
      ) {
        toggledBottom = true;
        TickBitMap.flipTick(state, bottomTick, state.tickSpacing);
      }
      if (
        Tick.update(
          state,
          topTick,
          cache.tick,
          liquidityDelta,
          secondsPerLiquidityCumulative,
          tickCumulative,
          time,
          true, // isTopTick
          state.maxLiquidityPerTick,
        )
      ) {
        toggledTop = true;
        TickBitMap.flipTick(state, topTick, state.tickSpacing);
      }
    }

    // skip fee && position related stuffs

    // same as UniwapV3Pool.sol line 327 ->   if (params.liquidityDelta != 0) {
    if (liquidityDelta !== 0n) {
      // if liquidityDelta is negative and the tick was toggled, it means that it should not be initialized anymore, so we delete it
      if (liquidityDelta < 0) {
        if (toggledBottom) Tick.clear(state, bottomTick);
        if (toggledTop) Tick.clear(state, topTick);
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
        let newTimepointIndex = DataStorageOperator.write(
          state,
          cache.timepointIndex,
          this._blockTimestamp(state),
          cache.tick,
          liquidityBefore,
          //, volumePerLiquidityInBlock,
        );
        if (cache.timepointIndex != newTimepointIndex) {
          // skip fee, updated via another handler
          //globalState.fee = _getNewFee(_blockTimestamp(), cache.tick, newTimepointIndex, liquidityBefore);
          globalState.timepointIndex = newTimepointIndex;
          // state.volumePerLiquidityInBlock = 0n;
        }
        // same as UniswapV3Pool line 361 ->  liquidity = LiquidityMath.addDelta(liquidityBefore, params.liquidityDelta);
        state.liquidity = LiquidityMath.addDelta(
          liquidityBefore,
          liquidityDelta,
        );
      }
    }

    // TODO mutate poolState
  }

  _calculateSwapAndLock(
    logger: Logger,
    poolState: PoolState,
    zeroToOne: boolean,
    newSqrtPriceX96: bigint,
    newTick: bigint,
    newLiquidity: bigint,
  ): [bigint, bigint, bigint, bigint, bigint, bigint] {
    const {
      globalState,
      liquidity,
      // volumePerLiquidityInBlock
    } = poolState;

    let blockTimestamp;
    let cache: SwapCalculationCache = {
      amountCalculated: 0n,
      amountRequiredInitial: BI_MAX_INT, // similarly to waht we did for uniswap
      communityFee: 0n,
      computedLatestTimepoint: false,
      exactInput: false,
      fee: 0n,
      incentiveStatus: Status.NOT_EXIST,
      secondsPerLiquidityCumulative: 0n,
      startTick: 0n,
      tickCumulative: 0n,
      timepointIndex: 0n,
      //volumePerLiquidityInBlock: 0n,
      isFirstCycleState: true,
    };
    let communityFeeAmount = 0n;

    // load from one storage slot
    let currentPrice = globalState.price;
    let currentTick = globalState.tick;
    cache.fee = globalState.fee;
    cache.timepointIndex = globalState.timepointIndex;
    let _communityFeeToken0 = globalState.communityFeeToken0;
    let _communityFeeToken1 = globalState.communityFeeToken1;
    // let unlocked = globalState.unlocked;

    // globalState.unlocked = false; // lock will not be released in this function
    //_require(unlocked, 'LOK');

    let amountRequired = cache.amountRequiredInitial; // to revalidate

    _require(amountRequired != 0n, 'AS');
    [cache.amountRequiredInitial, cache.exactInput] = [
      amountRequired,
      amountRequired > 0,
    ];

    let currentLiquidity;

    [
      currentLiquidity,
      // cache.volumePerLiquidityInBlock
    ] = [
      liquidity,
      //volumePerLiquidityInBlock,
    ];

    if (zeroToOne) {
      // require(limitSqrtPrice < currentPrice && limitSqrtPrice > TickMath.MIN_SQRT_RATIO, 'SPL');

      // cache.totalFeeGrowth = totalFeeGrowth0Token;
      cache.communityFee = _communityFeeToken0;
    } else {
      // require(limitSqrtPrice > currentPrice && limitSqrtPrice < TickMath.MAX_SQRT_RATIO, 'SPL')
      // cache.totalFeeGrowth = totalFeeGrowth1Token;
      cache.communityFee = _communityFeeToken1;
    }

    cache.startTick = currentTick;

    blockTimestamp = this._blockTimestamp(poolState);

    // skip incentive related stuff

    logger.info('_calculateSwapAndLock: start write timepoint');
    const newTimepointIndex = DataStorageOperator.write(
      poolState,
      cache.timepointIndex,
      blockTimestamp,
      cache.startTick,
      currentLiquidity,
      // cache.volumePerLiquidityInBlock,
    );
    logger.info('_calculateSwapAndLock: finished write timepoint');

    // new timepoint appears only for first swap in block
    if (newTimepointIndex != cache.timepointIndex) {
      cache.timepointIndex = newTimepointIndex;
      // cache.volumePerLiquidityInBlock = 0n;
      cache.fee = poolState.globalState.fee; // safe to take as updated just before// _getNewFee(blockTimestamp, currentTick, newTimepointIndex, currentLiquidity);
    }

    const step: PriceMovementCache = {
      feeAmount: 0n,
      initialized: true,
      input: 0n,
      nextTick: 0n,
      nextTickPrice: 0n,
      output: 0n,
      stepSqrtPrice: 0n,
      tickCount: 0,
    };
    let i = 0;
    // swap until there is remaining input or output tokens or we reach the price limit
    while (true) {
      logger.info(`_calculateSwapAndLock: loop integration ${++i}`);

      step.stepSqrtPrice = currentPrice;

      //equivalent of tickTable.nextTickInTheSameRow(currentTick, zeroToOne);
      [step.nextTick, step.initialized] =
        TickBitMap.nextInitializedTickWithinOneWord(
          poolState,
          currentTick,
          poolState.tickSpacing,
          zeroToOne,
          false,
        );

      step.nextTickPrice = TickMath.getSqrtRatioAtTick(step.nextTick);

      // equivalent of  PriceMovementMath.movePriceTowardsTarget
      const result = SwapMath.computeSwapStep(
        poolState.globalState.price,
        zeroToOne == step.nextTickPrice < newSqrtPriceX96
          ? newSqrtPriceX96
          : step.nextTickPrice,
        currentLiquidity,
        amountRequired,
        cache.fee,
      );
      [currentPrice, step.input, step.output, step.feeAmount] = [
        result.sqrtRatioNextX96, // TODO validate
        result.amountIn,
        result.amountOut,
        result.feeAmount,
      ];

      if (cache.exactInput) {
        amountRequired -= int256(step.input + step.feeAmount); // decrease remaining input amount
        cache.amountCalculated = cache.amountCalculated - int256(step.output); // decrease calculated output amount
      } else {
        amountRequired += int256(step.output); // increase remaining output amount (since its negative)
        cache.amountCalculated =
          cache.amountCalculated + int256(step.input + step.feeAmount); // increase calculated input amount
      }

      if (cache.communityFee > 0) {
        let delta =
          (step.feeAmount * cache.communityFee) /
          Constants.COMMUNITY_FEE_DENOMINATOR;
        step.feeAmount -= delta;
        communityFeeAmount += delta;
      }

      // skip totalFeeGrowth fee logic

      if (currentPrice == step.nextTickPrice) {
        // if the reached tick is initialized then we need to cross it
        if (step.initialized) {
          // once at a swap we have to get the last timepoint of the observation
          if (!cache.computedLatestTimepoint) {
            logger.info(`_calculateSwapAndLock: before getting timepoint`);
            [cache.tickCumulative, cache.secondsPerLiquidityCumulative, ,] =
              DataStorageOperator.getSingleTimepoint(
                poolState,
                blockTimestamp,
                0n,
                cache.startTick,
                cache.timepointIndex,
                currentLiquidity, // currentLiquidity can be changed only after computedLatestTimepoint
              );
            cache.computedLatestTimepoint = true;
            // cache.totalFeeGrowthB = zeroToOne ? totalFeeGrowth1Token : totalFeeGrowth0Token;
          }
          // // every tick cross is needed to be duplicated in a virtual pool
          // if (cache.incentiveStatus != IAlgebraVirtualPool.Status.NOT_EXIST) {
          //   IAlgebraVirtualPool(activeIncentive).cross(step.nextTick, zeroToOne);
          // }
          let liquidityDelta;
          logger.info(`_calculateSwapAndLock: before tick cross`);

          if (zeroToOne) {
            liquidityDelta = -Tick.cross(
              poolState.ticks,
              step.nextTick,
              // cache.totalFeeGrowth, // A == 0
              // cache.totalFeeGrowthB, // B == 1
              cache.secondsPerLiquidityCumulative,
              cache.tickCumulative,
              blockTimestamp,
            );
          } else {
            liquidityDelta = Tick.cross(
              poolState.ticks,
              step.nextTick,
              // cache.totalFeeGrowthB, // B == 0
              // cache.totalFeeGrowth, // A == 1
              cache.secondsPerLiquidityCumulative,
              cache.tickCumulative,
              blockTimestamp,
            );
          }
          logger.info(`_calculateSwapAndLock: after tick cross`);

          currentLiquidity = LiquidityMath.addDelta(
            currentLiquidity,
            liquidityDelta,
          );
        }

        currentTick = zeroToOne ? step.nextTick - 1n : step.nextTick;
      } else if (currentPrice != step.stepSqrtPrice) {
        // if the price has changed but hasn't reached the target
        currentTick = TickMath.getTickAtSqrtRatio(currentPrice);
        break; // since the price hasn't reached the target, amountRequired should be 0
      }

      // check stop condition
      if (
        amountRequired == 0n ||
        currentPrice == newSqrtPriceX96 ||
        currentTick === newTick // deviation from contract
      ) {
        break;
      }
    }

    let [amount0, amount1] =
      zeroToOne == cache.exactInput // the amount to provide could be less then initially specified (e.g. reached limit)
        ? [cache.amountRequiredInitial - amountRequired, cache.amountCalculated] // the amount to get could be less then initially specified (e.g. reached limit)
        : [
            cache.amountCalculated,
            cache.amountRequiredInitial - amountRequired,
          ];

    // validate that amount0 and amount 1 are same here

    [
      globalState.price,
      globalState.tick,
      globalState.fee,
      globalState.timepointIndex,
    ] = [currentPrice, currentTick, cache.fee, cache.timepointIndex];

    [
      poolState.liquidity,
      // poolState.volumePerLiquidityInBlock
    ] = [
      currentLiquidity,
      // cache.volumePerLiquidityInBlock +
      //   DataStorageOperator.calculateVolumePerLiquidity(
      //     currentLiquidity,
      //     amount0,
      //     amount1,
      //   ),
    ];

    // no need to update fees

    if (poolState.liquidity !== newLiquidity)
      // prefer assert ?
      poolState.liquidity = newLiquidity;

    return [
      amount0,
      amount1,
      currentPrice,
      currentTick,
      currentLiquidity,
      communityFeeAmount,
    ];
  }

  _blockTimestamp(state: DeepReadonly<PoolState>) {
    return uint32(state.blockTimestamp);
  }
}

export const AlgebraMath = new AlgebraMathClass();
