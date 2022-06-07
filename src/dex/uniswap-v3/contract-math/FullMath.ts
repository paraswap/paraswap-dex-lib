import { BI_MAX_UINT } from '../../../bigint-constants';
import { _require } from './utils';

export class FullMath {
  static mulDiv(a: bigint, b: bigint, denominator: bigint) {
    const result = (a * b) / denominator;

    _require(
      result <= BI_MAX_UINT,
      '',
      { result, BI_MAX_UINT },
      'result <= BI_MAX_UINT',
    );

    return result;
  }

  static mulDivRoundingUp(a: bigint, b: bigint, denominator: bigint) {
    const result = (a * b + denominator - 1n) / denominator;

    _require(
      result <= BI_MAX_UINT,
      '',
      { result, BI_MAX_UINT },
      'result <= BI_MAX_UINT',
    );

    return result;
  }
}
