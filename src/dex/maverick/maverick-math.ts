import { MathSol } from '../balancer-v2/balancer-v2-math';
import { BI_POWS } from '../../bigint-constants';
import { parseFixed, formatFixed, BigNumber } from '@ethersproject/bignumber';

const UNIT = BI_POWS[18];

export class MMath {
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
    const result = MathSol.mul(a, b);
    return MathSol.div(result, UNIT, false);
  }

  static div(a: bigint, b: bigint) {
    const result = MathSol.mul(a, UNIT);
    return MathSol.div(result, b, false);
  }

  static sqrt(a: bigint) {
    const result = Math.sqrt(parseFloat(formatFixed(a, 18)));
    return parseFixed(result.toString(), 18).toBigInt();
  }
}
