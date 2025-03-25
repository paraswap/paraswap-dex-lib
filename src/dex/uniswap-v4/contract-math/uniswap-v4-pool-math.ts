import { DeepReadonly } from 'ts-essentials';
import { PoolState, TickInfo, ModifyLiquidityParams } from '../types';
import { SwapSide } from '@paraswap/core';
import { TickMath } from './TickMath';
import { TickBitmap } from './TickBitmap';
import { Tick } from './Tick';
import { _require } from '../../../utils';
import { LiquidityMath } from './LiquidityMath';
import { Position } from './Position';
import { toBalanceDelta } from './utils';
import { SqrtPriceMath } from './SqrtPriceMath';

class UniswapV4PoolMath {
  swap(poolState: DeepReadonly<PoolState>, side: SwapSide) {
    // const slot0Start = poolState.slot0;
    // const isSell = side === SwapSide.SELL;
  }

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
}

export const uniswapV4PoolMath = new UniswapV4PoolMath();
