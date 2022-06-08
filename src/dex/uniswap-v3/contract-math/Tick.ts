import { PoolState } from '../types';
import { LiquidityMath } from './LiquidityMath';
import { _require } from '../../../utils';

export class Tick {
  static getFeeGrowthInside(
    state: PoolState,
    tickLower: bigint,
    tickUpper: bigint,
    tickCurrent: bigint,
    feeGrowthGlobal0X128: bigint,
    feeGrowthGlobal1X128: bigint,
  ): [bigint, bigint] {
    const lower = state.ticks[Number(tickLower)];
    const upper = state.ticks[Number(tickUpper)];

    let feeGrowthBelow0X128 = 0n;
    let feeGrowthBelow1X128 = 0n;
    if (tickCurrent >= tickLower) {
      feeGrowthBelow0X128 = lower.feeGrowthOutside0X128;
      feeGrowthBelow1X128 = lower.feeGrowthOutside1X128;
    } else {
      feeGrowthBelow0X128 = feeGrowthGlobal0X128 - lower.feeGrowthOutside0X128;
      feeGrowthBelow1X128 = feeGrowthGlobal1X128 - lower.feeGrowthOutside1X128;
    }

    let feeGrowthAbove0X128 = 0n;
    let feeGrowthAbove1X128 = 0n;
    if (tickCurrent < tickUpper) {
      feeGrowthAbove0X128 = upper.feeGrowthOutside0X128;
      feeGrowthAbove1X128 = upper.feeGrowthOutside1X128;
    } else {
      feeGrowthAbove0X128 = feeGrowthGlobal0X128 - upper.feeGrowthOutside0X128;
      feeGrowthAbove1X128 = feeGrowthGlobal1X128 - upper.feeGrowthOutside1X128;
    }

    return [
      feeGrowthGlobal0X128 - feeGrowthBelow0X128 - feeGrowthAbove0X128,
      feeGrowthGlobal1X128 - feeGrowthBelow1X128 - feeGrowthAbove1X128,
    ];
  }

  static update(
    state: PoolState,
    tick: bigint,
    tickCurrent: bigint,
    liquidityDelta: bigint,
    feeGrowthGlobal0X128: bigint,
    feeGrowthGlobal1X128: bigint,
    secondsPerLiquidityCumulativeX128: bigint,
    tickCumulative: bigint,
    time: bigint,
    upper: boolean,
    maxLiquidity: bigint,
  ): boolean {
    const info = state.ticks[Number(tick)];

    const liquidityGrossBefore = info.liquidityGross;
    const liquidityGrossAfter = LiquidityMath.addDelta(
      liquidityGrossBefore,
      liquidityDelta,
    );

    _require(
      liquidityGrossAfter <= maxLiquidity,
      'LO',
      { liquidityGrossAfter, maxLiquidity },
      'liquidityGrossAfter <= maxLiquidity',
    );

    const flipped = (liquidityGrossAfter == 0n) != (liquidityGrossBefore == 0n);

    if (liquidityGrossBefore == 0n) {
      if (tick <= tickCurrent) {
        info.feeGrowthOutside0X128 = feeGrowthGlobal0X128;
        info.feeGrowthOutside1X128 = feeGrowthGlobal1X128;
        info.secondsPerLiquidityOutsideX128 = secondsPerLiquidityCumulativeX128;
        info.tickCumulativeOutside = tickCumulative;
        info.secondsOutside = time;
      }
      info.initialized = true;
    }

    info.liquidityGross = liquidityGrossAfter;

    info.liquidityNet = upper
      ? info.liquidityNet - liquidityDelta
      : info.liquidityNet + liquidityDelta;
    return flipped;
  }

  static clear(state: PoolState, tick: bigint) {
    delete state.ticks[Number(tick)];
  }

  static cross(
    state: PoolState,
    tick: bigint,
    feeGrowthGlobal0X128: bigint,
    feeGrowthGlobal1X128: bigint,
    secondsPerLiquidityCumulativeX128: bigint,
    tickCumulative: bigint,
    time: bigint,
  ): bigint {
    const info = state.ticks[Number(tick)];
    info.feeGrowthOutside0X128 =
      feeGrowthGlobal0X128 - info.feeGrowthOutside0X128;
    info.feeGrowthOutside1X128 =
      feeGrowthGlobal1X128 - info.feeGrowthOutside1X128;
    info.secondsPerLiquidityOutsideX128 =
      secondsPerLiquidityCumulativeX128 - info.secondsPerLiquidityOutsideX128;
    info.tickCumulativeOutside = tickCumulative - info.tickCumulativeOutside;
    info.secondsOutside = time - info.secondsOutside;
    return info.liquidityNet;
  }
}
