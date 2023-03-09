import { BI_POWS } from '../../../bigint-constants';
import { _require } from '../../../utils';

const UNIT = BI_POWS[18];

export class MMath {
  static ONE = BI_POWS[18]; // 18 decimal places
  static MAX_POW_RELATIVE_ERROR = BI_POWS[4]; // 10 000

  static abs(x: bigint) {
    return x < 0n ? -x : x;
  }

  static min(a: bigint, b: bigint): bigint {
    return a < b ? a : b;
  }

  static max(a: bigint, b: bigint): bigint {
    return a >= b ? a : b;
  }

  static add(a: bigint, b: bigint): bigint {
    const c = a + b;
    _require((b >= 0 && c >= a) || (b < 0 && c < a), 'Errors.ADD_OVERFLOW');
    return c;
  }

  static sub(a: bigint, b: bigint): bigint {
    _require(b <= a, 'Errors.SUB_OVERFLOW');
    const c = a - b;
    return c;
  }

  static mul(a: bigint, b: bigint) {
    if ((MMath.abs(a) * MMath.abs(b)) % UNIT > 499999999999999999n) {
      return this.mulUpFixed(a, b);
    } else {
      return this.sMulDownFixed(a, b);
    }
  }

  static inv(a: bigint): bigint {
    return this.div(this.ONE, a);
  }

  static clip(x: bigint, y: bigint): bigint {
    return x < y ? 0n : x - y;
  }

  static mulUpFixed(a: bigint, b: bigint): bigint {
    const product = a * b;

    _require(a == 0n || product / a == b, 'Errors.MUL_OVERFLOW');

    let isNegative = false;
    if ((a < 0n && b > 0n) || (a > 0n && b < 0n)) {
      isNegative = true;
    }

    if (product == 0n) {
      return 0n;
    } else {
      let result = (this.abs(product) - 1n) / this.ONE + 1n;
      return isNegative ? -result : result;
    }
  }

  static div(a: bigint, b: bigint) {
    return this.divDownFixed(a, b);
  }

  static sqrt(x: bigint) {
    if (x == 0n) {
      return 0n;
    }

    x = x * UNIT;

    // Set the initial guess to the least power of two that is greater than or equal to sqrt(x).
    let xAux = x;
    let result = 1n;
    if (xAux >= 0x100000000000000000000000000000000) {
      xAux >>= 128n;
      result <<= 64n;
    }
    if (xAux >= 0x10000000000000000) {
      xAux >>= 64n;
      result <<= 32n;
    }
    if (xAux >= 0x100000000) {
      xAux >>= 32n;
      result <<= 16n;
    }
    if (xAux >= 0x10000) {
      xAux >>= 16n;
      result <<= 8n;
    }
    if (xAux >= 0x100) {
      xAux >>= 8n;
      result <<= 4n;
    }
    if (xAux >= 0x10) {
      xAux >>= 4n;
      result <<= 2n;
    }
    if (xAux >= 0x8) {
      result <<= 1n;
    }
    result = (result + x / result) >> 1n;
    result = (result + x / result) >> 1n;
    result = (result + x / result) >> 1n;
    result = (result + x / result) >> 1n;
    result = (result + x / result) >> 1n;
    result = (result + x / result) >> 1n;
    result = (result + x / result) >> 1n; // Seven iterations should be enough
    let roundedDownResult = x / result;
    return result >= roundedDownResult ? roundedDownResult : result;
  }

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
  static mulDiv(a: bigint, b: bigint, c: bigint, ceil: boolean): bigint {
    const product = a * b;
    _require(a == 0n || product / a == b, 'Errors.MUL_OVERFLOW');

    if (product == 0n) {
      return 0n;
    } else {
      if (ceil && product % c != 0n) {
        return product / c + 1n;
      } else {
        return product / c;
      }
    }
  }

  static sDivDownFixed(a: bigint, b: bigint): bigint {
    _require(b != 0n, 'Errors.ZERO_DIVISION');
    if (a == 0n) {
      return 0n;
    } else {
      const aInflated = a * this.ONE;
      // _require(aInflated / a == ONE, Errors.DIV_INTERNAL); // mul overflow

      return aInflated / b;
    }
  }

  static sMulUpFixed(a: bigint, b: bigint): bigint {
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

  static sMul(a: bigint, b: bigint): bigint {
    const c = a * b;
    _require(a == 0n || c / a == b, 'Errors.MUL_OVERFLOW');
    return c;
  }

  static sMulDownFixed(a: bigint, b: bigint): bigint {
    const product = a * b;
    _require(a == 0n || product / a == b, 'Errors.MUL_OVERFLOW');

    return product / this.ONE;
  }
}
