import { BI_MAX_UINT8 } from '../../../bigint-constants';
import { PoolState } from '../types';
import { BitMath } from './BitMath';
import { _require } from './utils';

export class TickBitMap {
  static position(tick: bigint): { wordPos: bigint; bitPos: bigint } {
    return { wordPos: tick >> 8n, bitPos: tick % 256n };
  }

  static flipTick(state: PoolState, tick: bigint, tickSpacing: bigint) {
    _require(
      tick % tickSpacing == 0n,
      '',
      { tick, tickSpacing },
      'tick % tickSpacing == 0n,',
    );
    const { wordPos, bitPos } = TickBitMap.position(tick / tickSpacing);
    const mask = 1n << bitPos;
    state.tickBitMap[wordPos.toString()] ^= mask;
  }

  static nextInitializedTickWithinOneWord(
    state: PoolState,
    tick: bigint,
    tickSpacing: bigint,
    lte: boolean,
  ): { next: bigint; initialized: boolean } {
    let compressed = tick / tickSpacing;
    if (tick < 0n && tick % tickSpacing != 0n) compressed--;

    let next;
    let initialized;

    if (lte) {
      const { wordPos, bitPos } = TickBitMap.position(compressed);
      const mask = (1n << bitPos) - 1n + (1n << bitPos);
      const masked = state.tickBitMap[wordPos.toString()] & mask;

      initialized = masked != 0n;
      next = initialized
        ? (compressed - bitPos - BitMath.mostSignificantBit(masked)) *
          tickSpacing
        : (compressed - bitPos) * tickSpacing;
    } else {
      // start from the word of the next tick, since the current tick state doesn't matter
      const { wordPos, bitPos } = TickBitMap.position(compressed + 1n);
      const mask = ~((1n << bitPos) - 1n);
      const masked = state.tickBitMap[wordPos.toString()] & mask;

      initialized = masked != 0n;
      next = initialized
        ? (compressed + 1n + BitMath.leastSignificantBit(masked) - bitPos) *
          tickSpacing
        : (compressed + 1n + BI_MAX_UINT8 - bitPos) * tickSpacing;
    }

    return { next, initialized };
  }
}
