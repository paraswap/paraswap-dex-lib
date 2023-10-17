export const NONE = 1n;
export const RIGHT = 2n;
export const LEFT = 4n;
export const BOTH = 8n;
const WORD_SIZE = 256n;
const OFFSET_MASK = 255n;
const BIT_MASK = 2n ** 256n - 1n;
const KINDS = 4n;
const MASK = 15n;

export type Active = {
  word: bigint;
  tick: bigint;
};

export class MaverickBinMap {
  static msb(x: bigint): bigint {
    // _require(x > 0, '', { x }, 'x > 0');
    let r = 0n;

    if (x >= 0x100000000000000000000000000000000n) {
      x >>= 128n;
      r += 128n;
    }
    if (x >= 0x10000000000000000n) {
      x >>= 64n;
      r += 64n;
    }
    if (x >= 0x100000000n) {
      x >>= 32n;
      r += 32n;
    }
    if (x >= 0x10000n) {
      x >>= 16n;
      r += 16n;
    }
    if (x >= 0x100n) {
      x >>= 8n;
      r += 8n;
    }
    if (x >= 0x10n) {
      x >>= 4n;
      r += 4n;
    }
    if (x >= 0x4n) {
      x >>= 2n;
      r += 2n;
    }
    if (x >= 0x2n) r += 1n;

    return r;
  }

  static lsb(x: bigint): bigint {
    // _require(x > 0, '', { x }, 'x > 0');

    let r = 255n;
    if ((x & 0xffffffffffffffffffffffffffffffffn) > 0) {
      r -= 128n;
    } else {
      x >>= 128n;
    }
    if ((x & 0xffffffffffffffffn) > 0) {
      r -= 64n;
    } else {
      x >>= 64n;
    }
    if ((x & 0xffffffffn) > 0) {
      r -= 32n;
    } else {
      x >>= 32n;
    }
    if ((x & 0xffffn) > 0) {
      r -= 16n;
    } else {
      x >>= 16n;
    }
    if ((x & 0xffn) > 0) {
      r -= 8n;
    } else {
      x >>= 8n;
    }
    if ((x & 0xfn) > 0) {
      r -= 4n;
    } else {
      x >>= 4n;
    }
    if ((x & 0x3n) > 0) {
      r -= 2n;
    } else {
      x >>= 2n;
    }
    if ((x & 0x1n) > 0) r -= 1n;
    return r;
  }

  static getMapPointer(tick: bigint): [bigint, bigint] {
    const offset = tick & OFFSET_MASK;
    const mapIndex = tick >> 8n;
    return [offset, mapIndex];
  }

  static putTypeAtTick(
    binMap: { [id: string]: bigint },
    kind: bigint,
    tick: bigint,
  ) {
    let [offset, mapIndex] = this.getMapPointer(tick * KINDS + kind);
    let subMap = binMap[mapIndex.toString()] || 0n;
    binMap[mapIndex.toString()] = subMap | (1n << offset);
  }

  static removeTypeAtTick(
    binMap: { [id: string]: bigint },
    kind: bigint,
    tick: bigint,
  ) {
    let [offset, mapIndex] = this.getMapPointer(tick * KINDS + kind);
    let subMap = binMap[mapIndex.toString()];
    binMap[mapIndex.toString()] = subMap & ~(1n << offset) & BIT_MASK;
    if (binMap[mapIndex.toString()] == 0n) {
      delete binMap[mapIndex.toString()];
    }
  }

  static getKindsAtTick(
    binMap: { [id: string]: bigint },
    tick: bigint,
  ): Active {
    let [offset, mapIndex] = this.getMapPointer(tick * KINDS);
    let subMap = binMap[mapIndex.toString()] || 0n;
    let presentBits = (subMap >> offset) & MASK;
    return {
      word: presentBits,
      tick: tick,
    };
  }

  static nextActive(
    binMap: { [id: string]: bigint },
    tick: bigint,
    isRight: boolean,
  ): bigint {
    let refTick = isRight ? tick + 1n : tick;
    let [offset, mapIndex] = this.getMapPointer(refTick * KINDS);
    let tack;
    let shift: bigint;
    let nextWord;
    let subIndex;
    let nextTick;

    if (isRight) {
      shift = offset;
      tack = 1n;
      nextTick = 1000000000n;
    } else {
      shift = WORD_SIZE - offset;
      tack = -1n;
      nextTick = -1000000000n;
    }

    for (let i = 0; i < 4000; i++) {
      nextWord = binMap[mapIndex.toString()] || 0n;
      nextWord = isRight ? nextWord >> shift : nextWord << shift;
      nextWord &= BIT_MASK;
      if (nextWord != 0n) break;
      shift = 0n;
      mapIndex += tack;
    }
    if (nextWord && nextWord != 0n) {
      subIndex = isRight
        ? this.lsb(nextWord) + shift
        : this.msb(nextWord) - shift;
      let posFirst = mapIndex * WORD_SIZE + subIndex;
      let pos = posFirst;
      if (posFirst < 0) pos += 1n;
      nextTick = pos / KINDS;
      if (posFirst < 0) nextTick -= 1n;
    }
    return nextTick;
  }
}
