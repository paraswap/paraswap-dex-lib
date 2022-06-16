import { BI_MAX_UINT8 } from '../../../bigint-constants';
import { PoolState } from '../types';
import { BitMath } from './BitMath';
import { _require } from '../../../utils';
import { DeepReadonly } from 'ts-essentials';
import {
  LOWER_TICK_REQUEST_LIMIT,
  UPPER_TICK_REQUEST_LIMIT,
} from '../constants';

export class TickBitMap {
  static position(tick: bigint): [bigint, bigint] {
    return [BigInt.asIntN(16, tick >> 8n), BigInt.asUintN(8, tick % 256n)];
  }

  static flipTick(state: PoolState, tick: bigint, tickSpacing: bigint) {
    _require(
      tick % tickSpacing == 0n,
      '',
      { tick, tickSpacing },
      'tick % tickSpacing == 0n,',
    );
    const [wordPos, bitPos] = TickBitMap.position(tick / tickSpacing);
    const mask = 1n << bitPos;
    state.tickBitmap[wordPos.toString()] ^= mask;
  }

  static nextInitializedTickWithinOneWord(
    state: DeepReadonly<PoolState>,
    tick: bigint,
    tickSpacing: bigint,
    lte: boolean,
  ): [bigint, boolean] {
    let compressed = tick / tickSpacing;
    if (tick < 0n && tick % tickSpacing != 0n) compressed--;

    let next = 0n;
    let initialized = false;

    if (lte) {
      const [wordPos, bitPos] = TickBitMap.position(compressed);
      const mask = (1n << bitPos) - 1n + (1n << bitPos);

      let tickBitmapValue = state.tickBitmap[wordPos.toString()];
      if (tickBitmapValue === undefined) {
        _require(
          wordPos > LOWER_TICK_REQUEST_LIMIT ||
            wordPos < UPPER_TICK_REQUEST_LIMIT,
          'wordPos is out of state tickBitmap request range',
          { wordPos },
          'wordPos > LOWER_TICK_REQUEST_LIMIT || wordPos < UPPER_TICK_REQUEST_LIMIT',
        );
        tickBitmapValue = 0n;
      }
      const masked = tickBitmapValue & mask;

      initialized = masked != 0n;
      next = initialized
        ? (compressed -
            BigInt.asIntN(24, bitPos - BitMath.mostSignificantBit(masked))) *
          tickSpacing
        : (compressed - BigInt.asIntN(24, bitPos)) * tickSpacing;
    } else {
      // start from the word of the next tick, since the current tick state doesn't matter
      const [wordPos, bitPos] = TickBitMap.position(compressed + 1n);
      const mask = ~((1n << bitPos) - 1n);

      let tickBitmapValue = state.tickBitmap[wordPos.toString()];
      if (tickBitmapValue === undefined) {
        _require(
          wordPos > UPPER_TICK_REQUEST_LIMIT ||
            wordPos < LOWER_TICK_REQUEST_LIMIT,
          'wordPos is out of state tickBitmap request range',
          { wordPos },
          'wordPos > UPPER_TICK_REQUEST_LIMIT || wordPos < LOWER_TICK_REQUEST_LIMIT',
        );
        tickBitmapValue = 0n;
      }

      const masked = tickBitmapValue & mask;

      initialized = masked != 0n;
      next = initialized
        ? (compressed +
            1n +
            BigInt.asIntN(24, BitMath.leastSignificantBit(masked) - bitPos)) *
          tickSpacing
        : (compressed + 1n + BigInt.asIntN(24, BI_MAX_UINT8 - bitPos)) *
          tickSpacing;
    }

    return [next, initialized];
  }
}
