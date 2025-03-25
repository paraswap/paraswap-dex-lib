import { _require } from '../../../utils';
import { TickMath } from './TickMath';
import { PoolState, TickInfo } from '../types';
import { LiquidityMath } from './LiquidityMath';

export class Tick {
  static check(tickLower: bigint, tickUpper: bigint) {
    _require(
      tickLower <= tickUpper,
      '',
      { tickLower, tickUpper },
      'tickLower <= tickUpper',
    );
    _require(
      tickLower >= TickMath.MIN_TICK,
      '',
      { tickLower },
      'tickLower >= TickMath.MIN_TICK',
    );
    _require(
      tickUpper <= TickMath.MAX_TICK,
      '',
      { tickUpper },
      'tickUpper <= TickMath.MAX_TICK',
    );
  }

  static clear(poolState: PoolState, tick: bigint): void {
    // delete poolState.ticks[Number(tick)];
    poolState.ticks[Number(tick)] = {
      liquidityGross: 0n,
      liquidityNet: 0n,
      feeGrowthOutside0X128: 0n,
      feeGrowthOutside1X128: 0n,
    };
  }

  static update(
    poolState: PoolState,
    tick: bigint,
    liquidityDelta: bigint,
    upper: boolean,
  ): { flipped: boolean; liquidityGrossAfter: bigint } {
    let info: TickInfo = poolState.ticks[Number(tick)];

    if (!info) {
      poolState.ticks[Number(tick)] = {
        liquidityGross: 0n,
        liquidityNet: 0n,
        feeGrowthOutside0X128: 0n,
        feeGrowthOutside1X128: 0n,
      };
      info = poolState.ticks[Number(tick)];
    }

    const liquidityGrossBefore = info.liquidityGross;
    const liquidityNetBefore = info.liquidityNet;

    const liquidityGrossAfter = LiquidityMath.addDelta(
      liquidityGrossBefore,
      liquidityDelta,
    );

    const flipped =
      (liquidityGrossAfter === 0n) !== (liquidityGrossBefore === 0n);

    if (liquidityGrossBefore === 0n) {
      if (tick <= poolState.slot0.tick) {
        info.feeGrowthOutside0X128 = poolState.feeGrowthGlobal0X128;
        info.feeGrowthOutside1X128 = poolState.feeGrowthGlobal1X128;
      }
    }

    const liquidityNet = upper
      ? liquidityNetBefore - liquidityDelta
      : liquidityNetBefore + liquidityDelta;

    info.liquidityGross = liquidityGrossAfter;
    info.liquidityNet = liquidityNet;

    return {
      flipped,
      liquidityGrossAfter,
    };
  }
}
