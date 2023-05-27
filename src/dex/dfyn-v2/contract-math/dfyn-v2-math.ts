import _ from 'lodash';
import {
  OutputResult,
  PoolState,
  Slot0,
  TickInfo,
  StructHelper,
} from '../types';
import { Ticks } from './Ticks';
import { TickMath } from './TickMath';
import { _require, bigIntify } from '../../../utils';
import { DeepReadonly } from 'ts-essentials';
import { NumberAsString, SwapSide } from '@paraswap/core';
import { BI_MAX_INT } from '../../../bigint-constants';
import {
  MAX_PRICING_COMPUTATION_STEPS_ALLOWED,
} from '../constants';
import { SwapExecuter } from './SwapExecuter';
import { stat } from 'fs';
import { FeeHandler } from './FeeHandler';
import { RebaseLibrary } from './RebaseLibrary';
import { Address } from '@0x/utils/lib/src/abi_encoder';
import { Pool } from '@hashflow/sdk/dist/modules/Pool';

// type ModifyPositionParams = {
//   tickLower: bigint;
//   tickUpper: bigint;
//   liquidityDelta: bigint;
// };



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
  debugger
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
    // cache.amountIn = BigInt(Math.abs(Number(cache.amountIn)))
    // cache.amountOut = BigInt(Math.abs(Number(cache.amountOut)))
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
      cache.nextTickToCross != TickMath.MIN_TICK ||
        cache.nextTickToCross != TickMath.MAX_TICK,
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

class Token0Missing extends Error {}
class Token1Missing extends Error {}

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
      //blockTimestamp: this._blockTimestamp(poolState),
      protocolFee: 0n,
      tickCount: 0,
      nextTickToCross: zeroForOne
        ? slot0Start.tick
        : ticksCopy[Number(slot0Start.tick)].nextTick,
      amountIn: 0n,
      amountOut: 0n,
      totalAmount: 0n,
      isFirstCycleState: true,
      exactIn: true,
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
      currentPrice: poolState.slot0.sqrtPriceX96,
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
        // if (isSell) {
          cache.amountIn = amountSpecified > 0n ? amountSpecified : 0n;
        // } else {
          cache.amountOut = amountSpecified > 0n ? 0n : -amountSpecified;
        // }
        cache.isFirstCycleState = false;
      } else {
        if (isSell) {
          cache.amountIn =
            amountSpecified - (previousAmount - cache.amountIn);
        } else {
          cache.amountOut =
            amountSpecified - (previousAmount - cache.amountOut);
        }
      }

      const exactInput = amountSpecified > 0n;
      cache.exactIn = exactInput;

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

        // We use it on next step to correct cache.amountIn or cache.amountOut
        previousAmount = amountSpecified;

        // First extract calculated values
        const [amount0, amount1] =
          zeroForOne === exactInput
            ? [amountSpecified - finalCache.amountIn, finalCache.totalAmount]
            : [finalCache.totalAmount, amountSpecified - finalCache.amountOut];
         
        finalCache.amountIn =
          amount1 - (
            zeroForOne ? 
              (cache.token0LimitOrderFee - cache.limitOrderFeeGrowth) : (cache.token1LimitOrderFee - cache.limitOrderFeeGrowth)
          );

        // Update for next amount
        // _updatePriceComputationObjects(state, latestFullCycleState);
        _updatePriceComputationObjects(cache, latestFullCycleCache);
        debugger
        if (isSell) {
          outputs[i] = BigInt.asUintN(256,(zeroForOne ? amount1 : amount0));
          tickCounts[i] = latestFullCycleCache.tickCount;
          continue;
        } else {
          outputs[i] =  BigInt.asUintN(256,(zeroForOne? amount0 : amount1));
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
    lastObservation: bigint,
    poolState: PoolState,
    newSqrtPriceX96: bigint,
    newTick: bigint,
    amount: bigint,
    //newLiquidity: bigint,
    zeroForOne: boolean,
  ): void {
     debugger
    //const total = zeroForOne ? poolState.total0 : poolState.total1;
    // if (amount == 0n) {
    //     // value of the share paid could be lower than the amount paid due to rounding, in that case, add a share (Always round up)
    //     amount = RebaseLibrary.toBase(total,amount);
    // } else {
        // amount may be lower than the value of share due to rounding, that's ok
    
    //const _amount = RebaseLibrary.toElastic(total,bigIntify(Math.abs(Number(amount))));
    
    // total.elastic = total.elastic + _amount;
    // total.base = total.base + bigIntify(Math.abs(Number(amount)));
    // There have to be at least 1000 shares left to prevent reseting the share/amount ratio (unless it's fully emptied)
    //require(total.base >= MINIMUM_SHARE_BALANCE || total.base == 0, "cannot be empty");
    // if(zeroForOne){
    //   poolState.total0 = total;
    // } else {
    //   poolState.total1 = total;
    // }

    
    
    // amount = RebaseLibrary.toBase(
    //     zeroForOne ? poolState.total1 : poolState.total0,
    //     amount
    //   )
  
    // const ticks = poolState.ticks
    //const limitOrderTicks = poolState.limitOrderTicks
    const slot0Start = poolState.slot0;

    const cache: StructHelper['SwapCache'] = {
      currentLiquidity: poolState.liquidity,
      protocolFee: 0n,
      tickCount: 0,
      nextTickToCross: zeroForOne
        ? slot0Start.tick
        : poolState.ticks[Number(slot0Start.tick)].nextTick,
      amountIn: amount > 0n ? amount: 0n,
      amountOut: amount < 0n ? -amount: 0n,
      totalAmount: 0n,
      isFirstCycleState: true,
      exactIn: amount > 0,
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
      currentPrice: poolState.slot0.sqrtPriceX96,
    };
    
    const diff = lastObservation - (poolState.lastObservation);
    if (diff > 0n && cache.currentLiquidity > 0n) {
      poolState.lastObservation = lastObservation;
      poolState.secondsGrowthGlobal = poolState.secondsGrowthGlobal + (diff << 128n )/(cache.currentLiquidity);
    }

    while (cache.exactIn ? cache.amountIn != 0n : cache.amountOut != 0n)
    {

      const swapLocal: StructHelper['SwapCacheLocal'] = {
        nextTickPrice: TickMath.getSqrtRatioAtTick(cache.nextTickToCross),
        cross: false,
        fee: 0n,
        amountIn: 0n,
        amountOut: 0n,
      };
      _require(
        cache.nextTickToCross != TickMath.MIN_TICK ||
          cache.nextTickToCross != TickMath.MAX_TICK,
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
          slot0Start.tick = cache.nextTickToCross;
        } else {
          cache.nearestPriceCached = zeroForOne
            ? cache.currentPrice + 1n
            : cache.currentPrice - 1n;
        }
      }
    }
    
    poolState.slot0.sqrtPriceX96 = cache.currentPrice;
    poolState.nearestPrice = cache.nearestPriceCached;
    const newNearestTick = zeroForOne ? cache.nextTickToCross : poolState.ticks[Number(cache.nextTickToCross)].previousTick;
    poolState.token0LimitOrderFee = cache.token0LimitOrderFee;
    poolState.token1LimitOrderFee = cache.token1LimitOrderFee;
    if (poolState.slot0.tick != newNearestTick) {
      poolState.slot0.tick = newNearestTick;
      poolState.liquidity = cache.currentLiquidity;
    }
    let amountOut = 0n;
    let amountIn = 0n;

    [amountOut,amountIn] = cache.exactIn ? [cache.totalAmount, amount] : [(-amount),cache.totalAmount];

    this._transfer(zeroForOne,poolState, amountOut, true);
    
    cache.amountIn = 
      amountIn - (
        zeroForOne ?
          (cache.token0LimitOrderFee - cache.limitOrderFeeGrowth) : (cache.token1LimitOrderFee - cache.limitOrderFeeGrowth)
      );
    debugger
    this._updateFees(poolState,zeroForOne,cache.feeGrowthGlobalB,cache.protocolFee)
    this._updateReserves(poolState,zeroForOne, cache.amountIn, amountOut, cache.limitOrderAmountIn, cache.limitOrderAmountOut);
  }

  private _updateFees(
    poolState: PoolState,
    zeroForOne: boolean,
    feeGrowthGlobal: bigint,
    protocolFee: bigint
  ): void {
    if (zeroForOne) {
      poolState.feeGrowthGlobal0 = feeGrowthGlobal;
      poolState.token0ProtocolFee += protocolFee;
    } else {
      poolState.feeGrowthGlobal1 = feeGrowthGlobal;
      poolState.token1ProtocolFee += protocolFee;
    }
  }
  

  private _transfer(
    zeroForOne:boolean,
    poolState: PoolState,
    //token: Address,
    shares: bigint,
    //to: Address,
    unwrapVault: boolean,
  ): void {
    if (unwrapVault) {
        this.withdraw(zeroForOne,poolState, 0n, shares);
    } else {
        // this.transfer(zeroForOne,poolState,token, address(this), to, shares);
    }
  }

      /// @notice Withdraws an amount of `token` from a user account.
    /// @param token_ The ERC-20 token to withdraw.
    /// @param from which user to pull the tokens.
    /// @param to which user to push the tokens.
    /// @param amount of tokens. Either one of `amount` or `share` needs to be supplied.
    /// @param share Like above, but `share` takes precedence over `amount`.
    private withdraw(
      zeroForOne:boolean,
      poolState: PoolState,
      // token: Address,
      // from: Address,
      // to: Address,
      amount:bigint,
      share:bigint
    ) : [bigint, bigint] {
      debugger
      // Checks
      //require(to != address(0), "to address not set"); // To avoid a bad UI from burning funds

      // Effects
      //IERC20 token = token_ == USE_ETHEREUM ? wethToken : token_;
      const total = zeroForOne ? poolState.total1 : poolState.total0;
      if (share == 0n) {
          // value of the share paid could be lower than the amount paid due to rounding, in that case, add a share (Always round up)
          share = RebaseLibrary.toBase(total,amount,false);
      } else {
          // amount may be lower than the value of share due to rounding, that's ok
          amount = RebaseLibrary.toElastic(total,share,false);
      }

      if(zeroForOne){
        poolState.vaultBalance1 = poolState.vaultBalance1-share;
        total.elastic = total.elastic - amount;
        total.base = total.base - share;
        poolState.total1 = total;
      } else {
        poolState.vaultBalance0 = poolState.vaultBalance0-share;
        total.elastic = total.elastic - amount;
        total.base = total.base - share;
        poolState.total0 = total;
      }
      
      
      // There have to be at least 1000 shares left to prevent reseting the share/amount ratio (unless it's fully emptied)
      //require(total.base >= MINIMUM_SHARE_BALANCE || total.base == 0, "cannot be empty");
      
      // Interactions
      // if (token_ == USE_ETHEREUM) {
      //     // X2, X3: A revert or big gas usage in the WETH contract could block withdrawals, but WETH9 is fine.
      //     IWETH(address(wethToken)).withdraw(amount);
      //     // X2, X3: A revert or big gas usage could block, however, the to address is under control of the caller.
      //     (bool success, ) = to.call{value: amount}("");
      //     require(success, "ETH transfer failed");
      // } else {
      //     // X2, X3: A malicious token could block withdrawal of just THAT token.
      //     //         masterContracts may want to take care not to rely on withdraw always succeeding.
      //     token.safeTransfer(to, amount);
      // }
      //emit LogWithdraw(token, from, to, amount, share);
      const amountOut = amount;
      const shareOut = share;
      return [amountOut, shareOut]
  }


  private _updateReserves(
    pool: PoolState,
    zeroForOne: boolean,
    inAmount: bigint,
    amountOut: bigint,
    limitOrderAmountIn: bigint,
    limitOrderAmountOut: bigint
  ): void {
    debugger
    if (zeroForOne) {
      const newBalance =  pool.balance0 + (inAmount - limitOrderAmountIn);
      if (newBalance > pool.vaultBalance0 ) throw new Token0Missing();
      pool.balance0 = newBalance;
      pool.balance1 -= amountOut - limitOrderAmountOut;
  
      pool.limitOrderReserve0 += limitOrderAmountIn;
      pool.limitOrderReserve1 -= limitOrderAmountOut;
    } else {
      const newBalance =  pool.balance1 + inAmount - limitOrderAmountIn;
      if (newBalance > pool.vaultBalance1) throw new Token1Missing();
      pool.balance1 = newBalance;
      pool.balance0 -= amountOut - limitOrderAmountOut;
  
      pool.limitOrderReserve0 -= limitOrderAmountOut;
      pool.limitOrderReserve1 += limitOrderAmountIn;
    }
  }

//   private _updatePosition(
//     _owner: string,
//     lower: bigint,
//     upper: bigint,
//     amount: bigint
// ): [bigint, bigint] {
//     const [rangeFeeGrowth0, rangeFeeGrowth1] = rangeFeeGrowth(lower, upper);
//     const [amount0Fees, amount1Fees] = SwapExecuter.updatePosition(
//         positions,
//         _owner,
//         lower,
//         upper,
//         amount,
//         rangeFeeGrowth0,
//         rangeFeeGrowth1,
//         MAX_TICK_LIQUIDITY
//     );
//     return [amount0Fees, amount1Fees];
// }

//   function mint(mintParams: MintParams): uint256 {
//     Validators._ensureTickSpacing(mintParams.lower, mintParams.upper, tickSpacing);
//     const priceLower: uint256 = TickMath.getSqrtRatioAtTick(mintParams.lower).toNumber();
//     const priceUpper: uint256 = TickMath.getSqrtRatioAtTick(mintParams.upper).toNumber();
//     const currentPrice: uint256 = nearestPrice.toNumber();

//     const liquidityMinted: uint256 = DyDxMath.getLiquidityForAmounts(
//         priceLower,
//         priceUpper,
//         currentPrice,
//         mintParams.amount1Desired.toNumber(),
//         mintParams.amount0Desired.toNumber()
//     );

//     if (liquidityMinted > uint128Max) revert new Overflow();

//     _updateSecondsPerLiquidity(liquidity.toNumber());

//     const data: InsertTickParams = {
//         nearestTick,
//         currentPrice: currentPrice as uint160,
//         tickCount,
//         amount: liquidityMinted as uint128,
//         tickAtPrice: TickMath.getTickAtSqrtRatio(currentPrice as uint160)
//     };

//     [nearestTick, tickCount] = Ticks.insert(
//         ticks,
//         limitOrderTicks,
//         feeGrowthGlobal0,
//         feeGrowthGlobal1,
//         secondsGrowthGlobal,
//         mintParams.lowerOld,
//         mintParams.lower,
//         mintParams.upperOld,
//         mintParams.upper,
//         data
//     );

//     const [amount0Fees, amount1Fees] = _updatePosition(
//         msg.sender,
//         mintParams.lower,
//         mintParams.upper,
//         liquidityMinted as int128
//     );
//     if (amount0Fees !== 0) {
//         _transfer(token0, amount0Fees, msg.sender, false);
//         reserve0 -= amount0Fees as uint128;
//     }
//     if (amount1Fees !== 0) {
//         _transfer(token1, amount1Fees, msg.sender, false);
//         reserve1 -= amount1Fees as uint128;
//     }

//     if (priceLower <= currentPrice && currentPrice < priceUpper) {
//         liquidity += liquidityMinted as uint128;
//     }

//     const [amount0Actual, amount1Actual] = DyDxMath.getAmountsForLiquidity(
//         priceLower,
//         priceUpper,
//         currentPrice,
//         liquidityMinted,
//         true
//     );

//     IPositionManager(msg.sender).mintCallback(token0, token1, amount0Actual, amount1Actual, mintParams.native);

//     if (amount0Actual !== 0) {
//         reserve0 += amount0Actual as uint128;
//         if (reserve0 + limitOrderReserve0 + token0LimitOrderFee > _balance(token0)) revert new Token0Missing();
//     }

//     if (amount1Actual !== 0) {
//         reserve1 += amount1Actual as uint128;
//         if (reserve1 + limitOrderReserve1 + token1LimitOrderFee > _balance(token1)) revert new Token1Missing();
//     }

//     emit Mint(msg.sender, amount0Actual, amount1Actual, mintParams.lower, mintParams.upper);

//     return liquidityMinted;
// }

}

export const dfynV2Math = new DfynV2Math();
