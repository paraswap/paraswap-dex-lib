import { _require } from '../../../utils';

export class SafeCast {
  static toInt256(a: bigint) {
    _require(a < 2n ** 255n, 'toInt256: a < 2n ** 255n');
    return BigInt.asIntN(256, a);
  }

  static revToInt256(a: bigint) {
    _require(a < 2n ** 255n, 'toInt256: a < 2n ** 255n');
    return BigInt.asIntN(256, -a);
  }

  static revToInt128(a: bigint) {
    _require(a < 2n ** 127n, 'toInt256: a < 2n ** 255n');
    return BigInt.asIntN(128, -a);
  }

  static revToUint256(a: bigint) {
    return BigInt.asUintN(256, -a);
  }

  static revToUint128(a: bigint) {
    return BigInt.asUintN(128, -a);
  }

  static toUint160(y: bigint) {
    _require(BigInt.asUintN(160, y) == y, 'toUint160 overflow');
    return BigInt.asUintN(160, y);
  }
}
