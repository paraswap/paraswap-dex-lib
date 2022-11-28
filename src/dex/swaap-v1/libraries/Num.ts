import {
  BI_MAX_INT,
  BI_MAX_UINT256 as BI_MAX_UINT,
} from '../../../bigint-constants';
import { Const } from './Const';

const _require = (b: boolean, message: string) => {
  if (!b) throw new Error(message);
};

export class Num {
  /**
   * @dev Returns the addition of two signed integers, reverting on overflow.
   */
  static add(a: bigint, b: bigint): bigint {
    const c = a + b;
    _require(c <= BI_MAX_UINT, 'Errors.ADD_OVERFLOW');
    return c;
  }

  /**
   * @dev Returns the subtraction of two unsigned integers of 256 bits, reverting on overflow.
   */
  static sub(a: bigint, b: bigint): bigint {
    _require(a >= 0n && b >= 0n, 'Errors.NEGATIVE_UINT');
    _require(b <= a, 'Errors.SUB_OVERFLOW');
    const c = a - b;
    return c;
  }

  static toi(a: bigint): bigint {
    return a / Const.ONE;
  }

  static floor(a: bigint): bigint {
    return this.toi(a) * Const.ONE;
  }

  static subSign(a: bigint, b: bigint): [bigint, boolean] {
    if (a >= b) {
      return [a - b, false];
    } else {
      return [b - a, true];
    }
  }

  static mul(a: bigint, b: bigint): bigint {
    const c1 = a * b + Const.ONE / 2n;
    // Second conditions is added in case c1 was an int256 (and not a uint256)
    _require(c1 <= BI_MAX_UINT && c1 >= -BI_MAX_INT, 'Err.MATH_OVERFLOW');
    return c1 / Const.ONE;
  }

  static mulTruncated(a: bigint, b: bigint): bigint {
    const c0 = a * b;
    _require(c0 <= BI_MAX_UINT, 'Err.MATH_OVERFLOW');
    return c0 / Const.ONE;
  }

  static div(a: bigint, b: bigint): bigint {
    const c1 = a * Const.ONE + b / 2n;
    _require(c1 <= BI_MAX_UINT, 'Err.MATH_OVERFLOW');
    return c1 / b;
  }

  static divTruncated(a: bigint, b: bigint): bigint {
    const c0 = a * Const.ONE;
    _require(c0 <= BI_MAX_UINT, 'Err.MATH_OVERFLOW');
    return c0 / b;
  }

  // DSMath.wpow
  static powi(a: bigint, n: bigint): bigint {
    let z = n % 2n != 0n ? a : Const.ONE;

    for (n /= 2n; n != 0n; n /= 2n) {
      a = this.mul(a, a);

      if (n % 2n != 0n) {
        z = this.mul(z, a);
      }
    }
    return z;
  }

  // Compute b^(e.w) by splitting it into (b^e)*(b^0.w).
  // Use `powi` for `b^e` and `powK` for k iterations
  // of approximation of b^0.w
  static pow(base: bigint, exp: bigint): bigint {
    _require(base >= Const.MIN_POW_BASE, 'Err.POW_BASE_TOO_LOW');
    _require(base <= Const.MAX_POW_BASE, 'Err.POW_BASE_TOO_HIGH');

    const whole = this.floor(exp);
    const remain = exp - whole;

    const wholePow = this.powi(base, this.toi(whole));

    if (remain == 0n) {
      return wholePow;
    }

    const partialResult = this.powApprox(base, remain, Const.POW_PRECISION);
    return this.mul(wholePow, partialResult);
  }

  static powApprox(base: bigint, exp: bigint, precision: bigint): bigint {
    // term 0:
    const a = exp;
    const [x, xneg] = this.subSign(base, Const.ONE);

    let term = Const.ONE;
    let sum = term;
    let negative = false;

    // term(k) = numer / denom
    //         = (product(a - i - 1, i=1-->k) * x^k) / (k!)
    // each iteration, multiply previous term by (a-(k-1)) * x / k
    // continue until term is less than precision
    for (let i = 1n; term >= precision; i++) {
      const bigK = i * Const.ONE;
      const [c, cneg] = this.subSign(a, bigK - Const.ONE);
      term = this.mul(term, this.mul(c, x));
      term = this.div(term, bigK);
      if (term == 0n) break;

      if (xneg) negative = !negative;
      if (cneg) negative = !negative;
      if (negative) {
        sum = this.sub(sum, term);
      } else {
        sum = this.add(sum, term);
      }
    }

    return sum;
  }

  /**
   * @notice Computes the division of 2 int256 with ONE precision
   * @dev Converts inputs to uint256 if needed, and then uses div(uint256, uint256)
   * @param a The int256 representation of a floating point number with ONE precision
   * @param b The int256 representation of a floating point number with ONE precision
   * @return b The division of 2 int256 with ONE precision
   */
  static divInt256(a: bigint, b: bigint): bigint {
    if (a < 0) {
      if (b < 0) {
        return Num.div(-a, -b); // both negative
      } else {
        return -Num.div(-a, b); // a < 0, b >= 0
      }
    } else {
      if (b < 0) {
        return -Num.div(a, -b); // a >= 0, b < 0
      } else {
        return Num.div(a, b); // both positive
      }
    }

    // _require(c2 <= BI_MAX_INT, "Err.MATH_OVERFLOW");
    // _require(c2 >= -BI_MAX_INT, "Err.MATH_UNDERFLOW");
  }

  static positivePart(value: bigint): bigint {
    if (value <= 0n) {
      return 0n;
    }
    return value;
  }

  static max(a: bigint, b: bigint): bigint {
    if (a > b) {
      return a;
    }
    return b;
  }

  static min(a: bigint, b: bigint): bigint {
    if (a < b) {
      return a;
    }
    return b;
  }
}
