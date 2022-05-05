import { BI_POWS } from '../../bigint-constants';

class WooFiDecimalMath {
  readonly ONE = BI_POWS[18];
  readonly TWO = 2n * BI_POWS[18];
  readonly ONE2 = BI_POWS[36];

  mulFloor(target: bigint, d: bigint): bigint {
    // target.mul(d) / (10**18);
    return (target * d) / BI_POWS[18];
  }

  mulCeil(target: bigint, d: bigint): bigint {
    // _divCeil(target.mul(d), 10 ** 18);
    return this._divCeil(target * d, BI_POWS[18]);
  }

  divFloor(target: bigint, d: bigint): bigint {
    // target.mul(10 ** 18).div(d);
    return (target * BI_POWS[18]) / d;
  }

  divCeil(target: bigint, d: bigint): bigint {
    // _divCeil(target.mul(10 ** 18), d);
    return this._divCeil(target * BI_POWS[18], d);
  }

  reciprocalFloor(target: bigint): bigint {
    // uint256(10 ** 36).div(target);
    return BI_POWS[36] / target;
  }

  reciprocalCeil(target: bigint): bigint {
    // _divCeil(uint256(10 ** 36), target);
    return this._divCeil(BI_POWS[36], target);
  }

  private _divCeil(a: bigint, b: bigint): bigint {
    const quotient = a / b;
    const remainder = a - quotient * b;
    return remainder > 0n ? quotient + 1n : quotient;
  }
}

export const wooFiDecimalMath = new WooFiDecimalMath();
