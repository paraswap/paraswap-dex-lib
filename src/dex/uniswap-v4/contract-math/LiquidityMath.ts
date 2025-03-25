import { _require } from '../../../utils';

export class LiquidityMath {
  static addDelta(x: bigint, y: bigint): bigint {
    const maxUint128 = (1n << 128n) - 1n;

    if (x < 0n || x > maxUint128) {
      throw new Error('x is out of uint128 range');
    }

    if (y < -(1n << 127n) || y >= 1n << 127n) {
      throw new Error('y is out of int128 range');
    }

    const z = x + y;

    if (z < 0n || z > maxUint128) {
      throw new Error('SafeCastOverflow');
    }

    return z;
  }
}
