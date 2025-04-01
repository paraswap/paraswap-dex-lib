import { PoolState, TickInfo, ModifyLiquidityParams } from '../types';
import { TickMath } from './TickMath';
import { TickBitmap } from './TickBitmap';
import { Tick } from './Tick';
import { _require } from '../../../utils';
import { LiquidityMath } from './LiquidityMath';
import { Position } from './Position';
import { SqrtPriceMath } from './SqrtPriceMath';
import { UnsafeMath } from './UnsafeMath';
import { FixedPoint128 } from './FixedPoint128';
import { ProtocolFeeLibrary } from './ProtocolFeeLibrary';
import { SwapMath } from './SwapMath';
import { toBalanceDelta } from './BalanceDelta';
import { BI_MAX_INT } from '../../../bigint-constants';

type StepComputations = {
  sqrtPriceStartX96: bigint;
  tickNext: bigint;
  initialized: boolean;
  sqrtPriceNextX96: bigint;
  amountIn: bigint;
  amountOut: bigint;
  feeAmount: bigint;
  feeGrowthGlobalX128: bigint;
};

class UniswapV4PoolMath {
  tickSpacingToMaxLiquidityPerTick(tickSpacing: bigint) {
    const MAX_TICK = TickMath.MAX_TICK;
    const MIN_TICK = TickMath.MIN_TICK;

    _require(
      tickSpacing >= 0n,
      'tickSpacing must be a positive integer.',
      { tickSpacing },
      'tickSpacing >= 0n',
    );

    let minTick = Math.floor(Number(MIN_TICK / tickSpacing));
    if (MIN_TICK % tickSpacing !== 0n) {
      minTick--;
    }

    const maxTick = Math.floor(Number(MAX_TICK / tickSpacing));
    const numTicks = BigInt(maxTick - minTick) + 1n;
    const MAX_UINT128 = (1n << 128n) - 1n;

    return MAX_UINT128 / numTicks;
  }

  checkPoolInitialized(poolState: PoolState) {
    const { sqrtPriceX96 } = poolState.slot0;
    _require(
      sqrtPriceX96 !== 0n,
      '',
      { sqrtPriceX96 },
      `Pool ${poolState.id} is not initialized`,
    );
  }

  getFeeGrowthInside(
    poolState: PoolState,
    tickLower: bigint,
    tickUpper: bigint,
  ): { feeGrowthInside0X128: bigint; feeGrowthInside1X128: bigint } {
    let lower: TickInfo = poolState.ticks[tickLower.toString()];
    let upper: TickInfo = poolState.ticks[tickUpper.toString()];
    const tickCurrent = BigInt(poolState.slot0?.tick!);

    let feeGrowthInside0X128: bigint;
    let feeGrowthInside1X128: bigint;

    if (tickCurrent < tickLower) {
      feeGrowthInside0X128 =
        lower.feeGrowthOutside0X128! - upper.feeGrowthOutside0X128!;
      feeGrowthInside1X128 =
        lower.feeGrowthOutside1X128! - upper.feeGrowthOutside1X128!;
    } else if (tickCurrent >= tickUpper) {
      feeGrowthInside0X128 =
        upper.feeGrowthOutside0X128! - lower.feeGrowthOutside0X128!;
      feeGrowthInside1X128 =
        upper.feeGrowthOutside1X128! - lower.feeGrowthOutside1X128!;
    } else {
      feeGrowthInside0X128 =
        BigInt(poolState.feeGrowthGlobal0X128!) -
        BigInt(lower.feeGrowthOutside0X128!) -
        BigInt(upper.feeGrowthOutside0X128!);
      feeGrowthInside1X128 =
        BigInt(poolState.feeGrowthGlobal1X128!) -
        BigInt(lower.feeGrowthOutside1X128!) -
        BigInt(upper.feeGrowthOutside1X128!);
    }

    return { feeGrowthInside0X128, feeGrowthInside1X128 };
  }

  modifyLiquidity(
    poolState: PoolState,
    {
      liquidityDelta,
      tickLower,
      tickUpper,
      tickSpacing,
      salt,
      owner,
    }: ModifyLiquidityParams,
  ) {
    Tick.check(tickLower, tickUpper);

    let flippedLower: boolean = false;
    let flippedUpper: boolean = false;

    if (liquidityDelta !== 0n) {
      const {
        flipped: flippedLowerVal,
        liquidityGrossAfter: liquidityGrossAfterLower,
      } = Tick.update(poolState, tickLower, liquidityDelta, false);

      flippedLower = flippedLowerVal;

      const {
        flipped: flippedUpperVal,
        liquidityGrossAfter: liquidityGrossAfterUpper,
      } = Tick.update(poolState, tickUpper, liquidityDelta, true);

      flippedUpper = flippedUpperVal;

      if (liquidityDelta >= 0n) {
        const maxLiquidityPerTick = this.tickSpacingToMaxLiquidityPerTick(
          BigInt(tickSpacing),
        );

        _require(
          liquidityGrossAfterLower < maxLiquidityPerTick,
          '',
          { liquidityGrossAfterLower, maxLiquidityPerTick },
          'liquidityGrossAfterLower < maxLiquidityPerTick',
        );

        _require(
          liquidityGrossAfterUpper < maxLiquidityPerTick,
          '',
          { liquidityGrossAfterUpper, maxLiquidityPerTick },
          'liquidityGrossAfterUpper < maxLiquidityPerTick',
        );
      }

      if (flippedLower) {
        TickBitmap.flipTick(
          poolState,
          tickLower,
          BigInt(poolState.tickSpacing),
        );
      }

      if (flippedUpper) {
        TickBitmap.flipTick(
          poolState,
          tickUpper,
          BigInt(poolState.tickSpacing),
        );
      }
    }

    const { feeGrowthInside0X128, feeGrowthInside1X128 } =
      this.getFeeGrowthInside(poolState, tickLower, tickUpper);

    const { feesOwed0, feesOwed1 } = Position.update(
      poolState,
      owner,
      tickLower,
      tickUpper,
      salt,
      liquidityDelta,
      feeGrowthInside0X128,
      feeGrowthInside1X128,
    );

    const feeDelta = toBalanceDelta(feesOwed0, feesOwed1);

    if (liquidityDelta < 0n) {
      if (flippedLower) {
        Tick.clear(poolState, tickLower);
      }
      if (flippedUpper) {
        Tick.clear(poolState, tickUpper);
      }
    }

    if (liquidityDelta !== 0n) {
      const slot0 = poolState.slot0!;
      const { tick, sqrtPriceX96 } = slot0;

      let delta: bigint;
      if (BigInt(tick) < tickLower) {
        delta = toBalanceDelta(
          SqrtPriceMath.getAmount0Delta(
            TickMath.getSqrtPriceAtTick(tickLower),
            TickMath.getSqrtPriceAtTick(tickUpper),
            liquidityDelta,
            false,
          ),
          0n,
        );
      } else if (BigInt(tick) < tickUpper) {
        delta = toBalanceDelta(
          SqrtPriceMath.getAmount0Delta(
            sqrtPriceX96,
            TickMath.getSqrtPriceAtTick(tickUpper),
            liquidityDelta,
            false,
          ),
          SqrtPriceMath.getAmount1Delta(
            TickMath.getSqrtPriceAtTick(tickLower),
            sqrtPriceX96,
            liquidityDelta,
            false,
          ),
        );

        poolState.liquidity = LiquidityMath.addDelta(
          poolState.liquidity!,
          liquidityDelta,
        );
      } else {
        delta = toBalanceDelta(
          0n,
          SqrtPriceMath.getAmount1Delta(
            TickMath.getSqrtPriceAtTick(tickLower),
            TickMath.getSqrtPriceAtTick(tickUpper),
            liquidityDelta,
            false,
          ),
        );
      }

      return { delta, feeDelta };
    }
  }

  setProtocolFee(poolState: PoolState, protocolFee: number): void {
    poolState.slot0.lpFee = protocolFee;
  }

  donate(poolState: PoolState, amount0: bigint, amount1: bigint): bigint {
    const liquidity = poolState.liquidity!;
    _require(liquidity !== 0n, '', { liquidity }, 'liquidity !== 0n');

    const delta = toBalanceDelta(-amount0, -amount1);

    if (amount0 > 0n) {
      poolState.feeGrowthGlobal0X128 += UnsafeMath.simpleMulDiv(
        amount0,
        FixedPoint128.Q128,
        liquidity,
      );
    }

    if (amount1 > 0n) {
      poolState.feeGrowthGlobal1X128 += UnsafeMath.simpleMulDiv(
        amount1,
        FixedPoint128.Q128,
        liquidity,
      );
    }

    return delta;
  }

  swapFromEvent(
    poolState: PoolState,
    zeroForOne: boolean,
    newSqrtPriceX96: bigint,
    newTick: bigint,
    newLiquidity: bigint,
    newSwapFee: bigint,
  ) {
    const slot0Start = poolState.slot0;
    // let result = {};

    const protocolFee = zeroForOne
      ? ProtocolFeeLibrary.getZeroForOneFee(slot0Start.protocolFee)
      : ProtocolFeeLibrary.getOneForZeroFee(slot0Start.protocolFee);

    // console.log('CUR POOL STATE Slot0 TICK: ', poolState.slot0.tick);
    // console.log('NEW TICK: ', newTick);
    //
    // console.log('newSqrtPriceX96: ', newSqrtPriceX96);
    // console.log('newLiquidity: ', newLiquidity);

    let amountSpecifiedRemaining = BI_MAX_INT;

    const lpFee = slot0Start.lpFee;
    const swapFee =
      protocolFee === 0
        ? lpFee
        : ProtocolFeeLibrary.calculateSwapFee(protocolFee, lpFee);

    let step = {} as StepComputations;
    step.feeGrowthGlobalX128 = zeroForOne
      ? poolState.feeGrowthGlobal0X128
      : poolState.feeGrowthGlobal1X128;

    while (
      BigInt(poolState.slot0.tick) !== newTick &&
      poolState.slot0.sqrtPriceX96 !== newSqrtPriceX96
    ) {
      // console.log('CUR TICK: ', poolState.slot0.tick);
      step.sqrtPriceStartX96 = poolState.slot0.sqrtPriceX96;

      const [next, initialized] = TickBitmap.nextInitializedTickWithinOneWord(
        poolState,
        BigInt(poolState.slot0.tick),
        BigInt(poolState.tickSpacing),
        zeroForOne,
      );

      // console.log('NEXT TICK: ', next);
      // console.log('initialized: ', initialized);

      step.tickNext = next;
      step.initialized = initialized;

      if (step.tickNext <= TickMath.MIN_TICK) {
        step.tickNext = TickMath.MIN_TICK;
      }

      if (step.tickNext >= TickMath.MAX_TICK) {
        step.tickNext = TickMath.MAX_TICK;
      }

      const sqrt = TickMath.getSqrtPriceAtTick(step.tickNext);
      // console.log('sqrtPriceNextX96: ', sqrt);
      step.sqrtPriceNextX96 = sqrt;

      const {
        sqrtPriceNextX96: resultSqrtPriceNextX96,
        amountIn: stepAmountIn,
        amountOut: stepAmountOut,
        feeAmount: stepFeeAmount,
      } = SwapMath.computeSwapStep(
        poolState.slot0.sqrtPriceX96,
        SwapMath.getSqrtPriceTarget(
          zeroForOne,
          step.sqrtPriceNextX96,
          poolState.slot0.sqrtPriceX96,
        ),
        poolState.liquidity,
        amountSpecifiedRemaining,
        BigInt(swapFee),
      );

      // console.log('resultSqrtPriceNextX96: ', resultSqrtPriceNextX96);

      poolState.slot0.sqrtPriceX96 = resultSqrtPriceNextX96;

      step.amountIn = stepAmountIn;
      step.amountOut = stepAmountOut;
      step.feeAmount = stepFeeAmount;
      //
      // if (params.amountSpecified > 0n) {
      //   amountSpecifiedRemaining -= step.amountOut;
      //   // amountCalculated -= step.amountIn + step.feeAmount;
      // } else {
      //   amountSpecifiedRemaining += step.amountIn + step.feeAmount;
      //   // amountCalculated += step.amountOut;
      // }

      if (protocolFee > 0) {
        const delta =
          swapFee === protocolFee
            ? step.feeAmount
            : ((step.amountIn + step.feeAmount) * BigInt(protocolFee)) /
              BigInt(ProtocolFeeLibrary.PIPS_DENOMINATOR);
        step.feeAmount -= delta;
      }

      if (poolState.liquidity > 0) {
        step.feeGrowthGlobalX128 += UnsafeMath.simpleMulDiv(
          step.feeAmount,
          FixedPoint128.Q128,
          newLiquidity,
        );
      }

      if (poolState.slot0.sqrtPriceX96 === step.sqrtPriceNextX96) {
        if (step.initialized) {
          const [feeGrowthGlobal0X128, feeGrowthGlobal1X128] = zeroForOne
            ? [step.feeGrowthGlobalX128, poolState.feeGrowthGlobal1X128]
            : [poolState.feeGrowthGlobal0X128, poolState.feeGrowthGlobal1X128];

          let liquidityNet = Tick.cross(
            poolState,
            step.tickNext,
            feeGrowthGlobal0X128,
            feeGrowthGlobal1X128,
          );

          if (zeroForOne) {
            liquidityNet = -liquidityNet;
          }

          poolState.liquidity = LiquidityMath.addDelta(
            poolState.liquidity,
            liquidityNet,
          );
        }

        poolState.slot0.tick = Number(
          zeroForOne ? step.tickNext - 1n : step.tickNext,
        );
      } else if (poolState.slot0.sqrtPriceX96 !== step.sqrtPriceStartX96) {
        poolState.slot0.tick = Number(
          TickMath.getTickAtSqrtPrice(poolState.slot0.sqrtPriceX96),
        );
      }
    }

    poolState.slot0.tick = Number(newTick);
    poolState.slot0.sqrtPriceX96 = newSqrtPriceX96;

    if (poolState.liquidity !== newLiquidity) {
      poolState.liquidity = newLiquidity;
    }

    if (!zeroForOne) {
      poolState.feeGrowthGlobal1X128 = step.feeGrowthGlobalX128;
    } else {
      poolState.feeGrowthGlobal0X128 = step.feeGrowthGlobalX128;
    }
    //
    // let swapDelta: bigint;
    // if (zeroForOne !== params.amountSpecified < 0) {
    //   swapDelta = toBalanceDelta(
    //     amountCalculated,
    //     params.amountSpecified - amountSpecifiedRemaining,
    //   );
    // } else {
    //   swapDelta = toBalanceDelta(
    //     params.amountSpecified - amountSpecifiedRemaining,
    //     amountCalculated,
    //   );
    // }

    // return { swapDelta, result, amountToProtocol };
  }
}

export const uniswapV4PoolMath = new UniswapV4PoolMath();
