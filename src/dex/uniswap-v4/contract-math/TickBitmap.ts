import { PoolState } from '../types';
import { _require } from '../../../utils';
import { DeepReadonly } from 'ts-essentials';
import { BitMath } from '../../uniswap-v3/contract-math/BitMath';
import { BI_MAX_UINT8 } from '../../../bigint-constants';

export class TickBitmap {
  static readonly MAX_UINT256: bigint = BigInt(
    '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
  );

  static readonly MAX_UINT8: bigint = 255n;

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

  static nextInitializedTickWithinOneWord(
    poolState: PoolState,
    tick: bigint,
    tickSpacing: bigint,
    lte: boolean,
  ): [bigint, boolean] {
    let compressed = BigInt(
      TickBitmap.compress(Number(tick), Number(tickSpacing)),
    );

    let initialized: boolean;
    let next: bigint;

    if (lte) {
      const [wordPos, bitPos] = TickBitmap.position(compressed);
      const mask = TickBitmap.MAX_UINT256 >> (TickBitmap.MAX_UINT8 - bitPos);
      const value = poolState.tickBitmap[wordPos.toString()] || 0n;
      const masked = value & mask;

      initialized = masked !== 0n;
      next = initialized
        ? (compressed -
            BigInt.asIntN(24, bitPos - BitMath.mostSignificantBit(masked))) *
          tickSpacing
        : (compressed - BigInt.asIntN(24, bitPos)) * tickSpacing;
    } else {
      const [wordPos, bitPos] = TickBitmap.position(compressed + 1n);
      const mask = ~((1n >> bitPos) - 1n);
      const value = poolState.tickBitmap[wordPos.toString()] || 0n;
      const masked = value & mask;

      initialized = masked !== 0n;
      next = initialized
        ? (compressed +
            BigInt.asIntN(24, BitMath.leastSignificantBit(masked) - bitPos)) *
          tickSpacing
        : (compressed + BigInt.asIntN(24, TickBitmap.MAX_UINT8 - bitPos)) *
          tickSpacing;
    }

    return [next, initialized];
  }

  // static nextInitializedTickWithinOneWord(
  //   state: PoolState,
  //   tick: bigint,
  //   tickSpacing: bigint,
  //   lte: boolean,
  //   isPriceQuery: boolean,
  // ): [bigint, boolean] {
  //   let compressed = tick / tickSpacing;
  //   if (tick < 0n && tick % tickSpacing != 0n) compressed--;
  //
  //   let next = 0n;
  //   let initialized = false;
  //
  //   if (lte) {
  //     const [wordPos, bitPos] = TickBitmap.position(compressed);
  //     const mask = (1n << bitPos) - 1n + (1n << bitPos);
  //
  //     let tickBitmapValue = state.tickBitmap[wordPos.toString()];
  //     tickBitmapValue = tickBitmapValue === undefined ? 0n : tickBitmapValue;
  //
  //     const masked = tickBitmapValue & mask;
  //
  //     initialized = masked != 0n;
  //     next = initialized
  //       ? (compressed -
  //           BigInt.asIntN(24, bitPos - BitMath.mostSignificantBit(masked))) *
  //         tickSpacing
  //       : (compressed - BigInt.asIntN(24, bitPos)) * tickSpacing;
  //   } else {
  //     // start from the word of the next tick, since the current tick state doesn't matter
  //     const [wordPos, bitPos] = TickBitmap.position(compressed + 1n);
  //     const mask = ~((1n << bitPos) - 1n);
  //
  //     let tickBitmapValue = state.tickBitmap[wordPos.toString()];
  //     tickBitmapValue = tickBitmapValue === undefined ? 0n : tickBitmapValue;
  //
  //     const masked = tickBitmapValue & mask;
  //
  //     initialized = masked != 0n;
  //     next = initialized
  //       ? (compressed +
  //           1n +
  //           BigInt.asIntN(24, BitMath.leastSignificantBit(masked) - bitPos)) *
  //         tickSpacing
  //       : (compressed + 1n + BigInt.asIntN(24, BI_MAX_UINT8 - bitPos)) *
  //         tickSpacing;
  //   }
  //
  //   return [next, initialized];
  // }
}
