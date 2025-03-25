import { PoolState } from '../types';
import { _require } from '../../../utils';

export class TickBitmap {
  static mostSignificantBit(value: number): number {
    let bit = 0;
    while (1 << bit <= value) bit++;
    return bit - 1;
  }

  static leastSignificantBit(value: number): number {
    return Math.floor(Math.log2(value & -value));
  }

  static compress(tick: number, tickSpacing: number): number {
    const compressed = Math.floor(tick / tickSpacing);
    if (tick < 0 && tick % tickSpacing !== 0) {
      return compressed - 1;
    }
    return compressed;
  }

  static position(tick: bigint): [bigint, bigint] {
    return [BigInt.asIntN(16, tick >> 8n), BigInt.asUintN(8, tick % 256n)];
  }

  static flipTick(
    poolState: PoolState,
    tick: bigint,
    tickSpacing: bigint,
  ): void {
    _require(
      tick % tickSpacing === 0n,
      '',
      { tick, tickSpacing },
      'tick % tickSpacing === 0n',
    );

    const compressedTick = tick / tickSpacing;
    const [wordPos, bitPos] = TickBitmap.position(compressedTick);

    const mask = 1n << bitPos;

    if (!poolState.tickBitmap) {
      poolState.tickBitmap = {};
    }

    const currentValue = poolState.tickBitmap[wordPos.toString()] || 0n;

    poolState.tickBitmap[wordPos.toString()] = currentValue ^ mask;
  }
}
