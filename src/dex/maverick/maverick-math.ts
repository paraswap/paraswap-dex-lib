import { MathSol } from '../balancer-v2/balancer-v2-math';
import { BI_POWS } from '../../bigint-constants';

const UNIT = BI_POWS[18];
const _require = (b: boolean, message: string) => {
  if (!b) throw new Error(message);
};
export class MMath {
  static ONE = BI_POWS[18]; // 18 decimal places
  static MAX_POW_RELATIVE_ERROR = BI_POWS[4]; // 10 000

  static abs(x: bigint) {
    return x < 0n ? -x : x;
  }

  static min(a: bigint, b: bigint) {
    return MathSol.min(a, b);
  }

  static max(a: bigint, b: bigint) {
    return MathSol.max(a, b);
  }

  static add(a: bigint, b: bigint) {
    return MathSol.add(a, b);
  }

  static sub(a: bigint, b: bigint) {
    return MathSol.sub(a, b);
  }

  static mul(a: bigint, b: bigint) {
    if ((MMath.abs(a) * MMath.abs(b)) % UNIT > 499999999999999999n) {
      return this.mulUpFixed(a, b);
    } else {
      return MathSol.mulDownFixed(a, b);
    }
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
    return MathSol.divDownFixed(a, b);
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
    // console.log("result1", result)
    result = (result + x / result) >> 1n;
    // console.log("result2", result)
    result = (result + x / result) >> 1n;
    // console.log("result3", result)
    result = (result + x / result) >> 1n;
    // console.log("result4", result)
    result = (result + x / result) >> 1n;
    // console.log("result5", result)
    result = (result + x / result) >> 1n;
    // console.log("result6", result)
    result = (result + x / result) >> 1n;
    // console.log("result7", result)
    result = (result + x / result) >> 1n; // Seven iterations should be enough
    // console.log("result8", result)
    let roundedDownResult = x / result;
    // console.log("rounddown", roundedDownResult)
    return result >= roundedDownResult ? roundedDownResult : result;
  }
}
