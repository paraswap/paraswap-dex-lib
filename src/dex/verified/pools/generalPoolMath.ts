import { BI_POWS } from '../../../bigint-constants';

const _require = (b: boolean, message: string) => {
  if (!b) throw new Error(message);
};

export class MathSol {
  /**
   * @dev Returns the addition of two unsigned integers of 256 bits, reverting on overflow.
   */
  // add(a: bigint, b: bigint): bigint {
  //     const c = a + b;
  //     // _require(c >= a, Errors.ADD_OVERFLOW);
  //     return c;
  // }

  /**
   * @dev Returns the addition of two signed integers, reverting on overflow.
   */
  static add(a: bigint, b: bigint): bigint {
    const c = a + b;
    _require((b >= 0 && c >= a) || (b < 0 && c < a), 'Errors.ADD_OVERFLOW');
    return c;
  }

  /**
   * @dev Returns the subtraction of two unsigned integers of 256 bits, reverting on overflow.
   */
  static sub(a: bigint, b: bigint): bigint {
    _require(b <= a, 'Errors.SUB_OVERFLOW');
    const c = a - b;
    return c;
  }

  /**
   * @dev Returns the subtraction of two signed integers, reverting on overflow.
   */
  // sub(int256 a, int256 b) internal pure returns (int256) {
  //     int256 c = a - b;
  //     // _require((b >= 0 && c <= a) || (b < 0 && c > a), Errors.SUB_OVERFLOW);
  //     return c;
  // }

  /**
   * @dev Returns the largest of two numbers of 256 bits.
   */
  static max(a: bigint, b: bigint): bigint {
    return a >= b ? a : b;
  }

  /**
   * @dev Returns the smallest of two numbers of 256 bits.
   */
  static min(a: bigint, b: bigint): bigint {
    return a < b ? a : b;
  }

  static mul(a: bigint, b: bigint): bigint {
    const c = a * b;
    _require(a == 0n || c / a == b, 'Errors.MUL_OVERFLOW');
    return c;
  }

  static div(a: bigint, b: bigint, roundUp: boolean): bigint {
    return roundUp ? this.divUp(a, b) : this.divDown(a, b);
  }

  static divDown(a: bigint, b: bigint): bigint {
    _require(b != 0n, 'Errors.ZERO_DIVISION');
    return a / b;
  }

  static divUp(a: bigint, b: bigint): bigint {
    _require(b != 0n, 'Errors.ZERO_DIVISION');

    if (a == 0n) {
      return 0n;
    } else {
      return 1n + (a - 1n) / b;
    }
  }

  // Modification: Taken from the fixed point class
  static ONE = BI_POWS[18]; // 18 decimal places
  static MAX_POW_RELATIVE_ERROR = BI_POWS[4]; // 10 000

  static mulUpFixed(a: bigint, b: bigint): bigint {
    const product = a * b;
    _require(a == 0n || product / a == b, 'Errors.MUL_OVERFLOW');

    if (product == 0n) {
      return 0n;
    } else {
      // The traditional divUp formula is:
      // divUp(x, y) := (x + y - 1) / y
      // To avoid intermediate overflow in the addition, we distribute the division and get:
      // divUp(x, y) := (x - 1) / y + 1
      // Note that this requires x != 0, which we already tested for.

      return (product - 1n) / this.ONE + 1n;
    }
  }

  // Modification: Taken from the fixed point class
  static divDownFixed(a: bigint, b: bigint): bigint {
    _require(b != 0n, 'Errors.ZERO_DIVISION');
    if (a == 0n) {
      return 0n;
    } else {
      const aInflated = a * this.ONE;
      // _require(aInflated / a == ONE, Errors.DIV_INTERNAL); // mul overflow

      return aInflated / b;
    }
  }

  // Modification: Taken from the fixed point class
  static divUpFixed(a: bigint, b: bigint): bigint {
    _require(b != 0n, 'Errors.ZERO_DIVISION');

    if (a == 0n) {
      return 0n;
    } else {
      const aInflated = a * this.ONE;
      _require(aInflated / a == this.ONE, 'Errors.DIV_INTERNAL'); // mul overflow

      // The traditional divUp formula is:
      // divUp(x, y) := (x + y - 1) / y
      // To avoid intermediate overflow in the addition, we distribute the division and get:
      // divUp(x, y) := (x - 1) / y + 1
      // Note that this requires x != 0, which we already tested for.

      return (aInflated - 1n) / b + 1n;
    }
  }

  static mulDownFixed(a: bigint, b: bigint): bigint {
    const product = a * b;
    _require(a == 0n || product / a == b, 'Errors.MUL_OVERFLOW');

    return product / this.ONE;
  }
}
