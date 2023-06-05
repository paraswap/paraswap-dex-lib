import { _require } from '../../../utils';

export class LiquidityMath {
  static addDelta(x: bigint, y: bigint): bigint {
    let z;
    if (y < 0) {
      const _y = BigInt.asUintN(128, -y);
      z = x - _y;
      _require(z < x, 'LS', { z, x, y, _y }, 'z < x');
    } else {
      const _y = BigInt.asUintN(128, y);
      z = x + _y;
      _require(z >= x, 'LA', { z, x, y, _y }, 'z >= x');
    }
    return z;
  }
}
