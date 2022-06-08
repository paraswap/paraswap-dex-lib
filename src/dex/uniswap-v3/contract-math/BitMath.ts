import {
  BI_MAX_UINT128,
  BI_MAX_UINT16,
  BI_MAX_UINT32,
  BI_MAX_UINT64,
  BI_MAX_UINT8,
} from '../../../bigint-constants';
import { _require } from './utils';

export class BitMath {
  static mostSignificantBit(x: bigint): bigint {
    _require(x > 0, '', { x }, 'x > 0');
    let r = 0n;

    if (x >= BigInt('0x100000000000000000000000000000000')) {
      x >>= 128n;
      r += 128n;
    }
    if (x >= BigInt('0x10000000000000000')) {
      x >>= 64n;
      r += 64n;
    }
    if (x >= BigInt('0x100000000')) {
      x >>= 32n;
      r += 32n;
    }
    if (x >= BigInt('0x10000')) {
      x >>= 16n;
      r += 16n;
    }
    if (x >= BigInt('0x100')) {
      x >>= 8n;
      r += 8n;
    }
    if (x >= BigInt('0x10')) {
      x >>= 4n;
      r += 4n;
    }
    if (x >= BigInt('0x4')) {
      x >>= 2n;
      r += 2n;
    }
    if (x >= BigInt('0x2')) r += 1n;

    return r;
  }

  static leastSignificantBit(x: bigint): bigint {
    _require(x > 0, '', { x }, 'x > 0');

    let r = 255n;
    if ((x & BI_MAX_UINT128) > 0n) {
      r -= 128n;
    } else {
      x >>= 128n;
    }
    if ((x & BI_MAX_UINT64) > 0n) {
      r -= 64n;
    } else {
      x >>= 64n;
    }
    if ((x & BI_MAX_UINT32) > 0n) {
      r -= 32n;
    } else {
      x >>= 32n;
    }
    if ((x & BI_MAX_UINT16) > 0n) {
      r -= 16n;
    } else {
      x >>= 16n;
    }
    if ((x & BI_MAX_UINT8) > 0n) {
      r -= 8n;
    } else {
      x >>= 8n;
    }
    if ((x & BigInt('0xf')) > 0n) {
      r -= 4n;
    } else {
      x >>= 4n;
    }
    if ((x & BigInt('0x3')) > 0n) {
      r -= 2n;
    } else {
      x >>= 2n;
    }
    if ((x & BigInt('0x1')) > 0n) r -= 1n;
    return r;
  }
}
