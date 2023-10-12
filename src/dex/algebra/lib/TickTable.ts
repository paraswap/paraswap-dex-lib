import { IAlgebraPoolState } from '../types';
import { _require } from '../../../utils';
import { DeepReadonly } from 'ts-essentials';
import {
  OUT_OF_RANGE_ERROR_POSTFIX,
  TICK_BITMAP_BUFFER,
  TICK_BITMAP_TO_USE,
} from '../../uniswap-v3/constants';
import { TickMath } from '../../uniswap-v3/contract-math/TickMath';
import { Yul } from './yul-helper';

function isWordPosOut(
  wordPos: bigint,
  startTickBitmap: bigint,
  // For pricing we use wider range to check price impact. If function called from event
  // it must always be within buffer
  isPriceQuery: boolean,
) {
  let lowerTickBitmapLimit;
  let upperTickBitmapLimit;

  if (isPriceQuery) {
    lowerTickBitmapLimit =
      startTickBitmap - (TICK_BITMAP_BUFFER + TICK_BITMAP_TO_USE);
    upperTickBitmapLimit =
      startTickBitmap + (TICK_BITMAP_BUFFER + TICK_BITMAP_TO_USE);
  } else {
    lowerTickBitmapLimit = startTickBitmap - TICK_BITMAP_BUFFER;
    upperTickBitmapLimit = startTickBitmap + TICK_BITMAP_BUFFER;
  }

  _require(
    wordPos >= lowerTickBitmapLimit && wordPos <= upperTickBitmapLimit,
    `wordPos is out of safe state tickBitmap request range: ${OUT_OF_RANGE_ERROR_POSTFIX}`,
    { wordPos },
    `wordPos >= LOWER_TICK_REQUEST_LIMIT && wordPos <= UPPER_TICK_REQUEST_LIMIT`,
  );
}

export class TickTable {
  static position(tick: bigint) {
    return [
      // wordPos
      BigInt.asIntN(16, tick >> 8n),
      // bitPos
      BigInt.asUintN(8, tick & 0xffn),
    ];
  }

  static toggleTick(
    state: Pick<IAlgebraPoolState, 'startTickBitmap' | 'tickBitmap'>,
    tick: bigint,
    tickSpacing?: bigint,
  ) {
    if (tickSpacing !== undefined) {
      tick /= tickSpacing;
    }
    const [rowNumber, bitNumber] = TickTable.position(tick);
    const mask = BigInt.asUintN(256, 1n << bitNumber);

    // toggleTick is used only in _updatePosition which is always state changing event
    // Therefore it is never used in price query
    isWordPosOut(rowNumber, state.startTickBitmap, false);

    const stringWordPos = rowNumber.toString();
    if (state.tickBitmap[stringWordPos] === undefined) {
      state.tickBitmap[stringWordPos] = 0n;
    }

    state.tickBitmap[stringWordPos] ^= mask;
    if (state.tickBitmap[stringWordPos] === 0n) {
      delete state.tickBitmap[stringWordPos];
    }
  }

  static nextInitializedTickWithinOneWord(
    state: DeepReadonly<
      Pick<IAlgebraPoolState, 'startTickBitmap' | 'tickBitmap'>
    >,
    tick: bigint,
    lte: boolean,
    isPriceQuery: boolean,
    tickSpacing?: bigint,
  ): [bigint, boolean] {
    if (tickSpacing !== undefined) {
      tick = BigInt.asIntN(
        24,
        Yul.sub(
          Yul.sdiv(tick, tickSpacing),
          Yul.and(
            Yul.slt(tick, 0n),
            Yul.not(Yul.iszero(Yul.smod(tick, tickSpacing))),
          ),
        ),
      );
    }
    if (lte) {
      const [rowNumber, bitNumber] = TickTable.position(tick);
      isWordPosOut(rowNumber, state.startTickBitmap, isPriceQuery);
      let tickBitmapValue = state.tickBitmap[rowNumber.toString()];
      tickBitmapValue = tickBitmapValue === undefined ? 0n : tickBitmapValue;

      const _row = BigInt.asUintN(256, tickBitmapValue << (255n - bitNumber));
      if (_row != 0n) {
        tick -= BigInt.asIntN(24, 255n - TickTable.getMostSignificantBit(_row));
        return [TickTable.boundTick(tick, tickSpacing), true];
      } else {
        tick -= BigInt.asIntN(24, bitNumber);
        return [TickTable.boundTick(tick, tickSpacing), false];
      }
    } else {
      tick += 1n;

      const [rowNumber, bitNumber] = TickTable.position(tick);
      isWordPosOut(rowNumber, state.startTickBitmap, isPriceQuery);
      let tickBitmapValue = state.tickBitmap[rowNumber.toString()];
      tickBitmapValue = tickBitmapValue === undefined ? 0n : tickBitmapValue;

      const _row = BigInt.asUintN(256, tickBitmapValue >> bitNumber);
      if (_row !== 0n) {
        tick += BigInt.asIntN(
          24,
          TickTable.getSingleSignificantBit(-_row & _row),
        );
        return [TickTable.boundTick(tick, tickSpacing), true];
      } else {
        tick += BigInt.asIntN(24, 255n - bitNumber);
        return [TickTable.boundTick(tick, tickSpacing), false];
      }
    }
  }

  static getSingleSignificantBit(word: bigint): bigint {
    let singleBitPos = 0n;
    singleBitPos = Yul.iszero(
      word &
        0x5555555555555555555555555555555555555555555555555555555555555555n,
    );
    singleBitPos =
      singleBitPos |
      (Yul.iszero(
        word &
          0x00000000000000000000000000000000ffffffffffffffffffffffffffffffffn,
      ) <<
        7n);
    singleBitPos =
      singleBitPos |
      (Yul.iszero(
        word &
          0x0000000000000000ffffffffffffffff0000000000000000ffffffffffffffffn,
      ) <<
        6n);
    singleBitPos =
      singleBitPos |
      (Yul.iszero(
        word &
          0x00000000ffffffff00000000ffffffff00000000ffffffff00000000ffffffffn,
      ) <<
        5n);
    singleBitPos =
      singleBitPos |
      (Yul.iszero(
        word &
          0x0000ffff0000ffff0000ffff0000ffff0000ffff0000ffff0000ffff0000ffffn,
      ) <<
        4n);
    singleBitPos =
      singleBitPos |
      (Yul.iszero(
        word &
          0x00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ffn,
      ) <<
        3n);
    singleBitPos =
      singleBitPos |
      (Yul.iszero(
        word &
          0x0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0fn,
      ) <<
        2n);
    singleBitPos =
      singleBitPos |
      (Yul.iszero(
        word &
          0x3333333333333333333333333333333333333333333333333333333333333333n,
      ) <<
        1n);

    return BigInt.asUintN(8, singleBitPos);
  }

  static getMostSignificantBit(word: bigint): bigint {
    word = word | (word >> 1n);
    word = word | (word >> 2n);
    word = word | (word >> 4n);
    word = word | (word >> 8n);
    word = word | (word >> 16n);
    word = word | (word >> 32n);
    word = word | (word >> 64n);
    word = word | (word >> 128n);
    word = word - (word >> 1n);
    return TickTable.getSingleSignificantBit(BigInt.asUintN(256, word));
  }

  static boundTick(tick: bigint, tickSpacing?: bigint): bigint {
    if (tickSpacing !== undefined) {
      tick *= tickSpacing;
    }
    let boundedTick = tick;
    if (boundedTick < TickMath.MIN_TICK) {
      boundedTick = TickMath.MIN_TICK;
    } else if (boundedTick > TickMath.MAX_TICK) {
      boundedTick = TickMath.MAX_TICK;
    }
    return boundedTick;
  }
}
