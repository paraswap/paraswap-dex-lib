import { _require } from '../../../utils';

export class UnsafeMath {
  static divRoundingUp(x: bigint, y: bigint): bigint {
    _require(y !== 0n, 'Division by zero', { y }, 'y !== 0n');

    return (x + y - 1n) / y;
  }

  static simpleMulDiv(a: bigint, b: bigint, denominator: bigint): bigint {
    _require(
      denominator !== 0n,
      'Division by zero',
      { denominator },
      'denominator !== 0n',
    );

    return (a * b) / denominator;
  }
}
