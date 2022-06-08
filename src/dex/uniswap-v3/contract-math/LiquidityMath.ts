import { _require } from './utils';

export class LiquidityMath {
  static addDelta(x: bigint, y: bigint): bigint {
    let z;
    if (y < 0) {
      z = x - -y;
      _require(z < x, 'LS', { z, x, y }, 'z < x');
    } else {
      z = x + y;
      _require(z >= x, 'LA', { z, x, y }, 'z >= x');
    }
    return z;
  }
}
