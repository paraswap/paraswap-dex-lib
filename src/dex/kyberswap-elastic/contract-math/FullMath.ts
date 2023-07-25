import { BI_MAX_UINT256 } from '../../../bigint-constants';
import { _require } from '../../../utils';

export class FullMath {
  static mulDivFloor(a: bigint, b: bigint, denominator: bigint) {
    const result = (a * b) / denominator;

    _require(
      result <= BI_MAX_UINT256,
      '',
      { result, BI_MAX_UINT: BI_MAX_UINT256 },
      'result <= BI_MAX_UINT',
    );

    return result;
  }

  static mulDivCeiling(a: bigint, b: bigint, denominator: bigint) {
    const result = (a * b + denominator - 1n) / denominator;

    _require(
      result <= BI_MAX_UINT256,
      '',
      { result, BI_MAX_UINT: BI_MAX_UINT256 },
      'result <= BI_MAX_UINT',
    );

    return result;
  }
}
