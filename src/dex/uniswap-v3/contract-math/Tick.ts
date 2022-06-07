import { PoolState } from '../types';

export class Tick {
  static cross(
    state: PoolState,
    tick: number,
    feeGrowthGlobal0X128: bigint,
    feeGrowthGlobal1X128: bigint,
    secondsPerLiquidityCumulativeX128: bigint,
    tickCumulative: bigint,
    time: bigint,
  ): bigint {
    const info = state.ticks[tick];
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
