import { _require } from '../../../utils';
import { BI_MAX_UINT256 } from '../../../bigint-constants';

export class BigIntMath {
  static max(...args: bigint[]): bigint {
    return args.reduce((m, e) => (e > m ? e : m));
  }

  static min(...args: bigint[]): bigint {
    return args.reduce((m, e) => (e < m ? e : m));
  }

  /**
   * @see FullMath.mulDiv
   */
  static mulDiv(a: bigint, b: bigint, denominator: bigint) {
    const result = (a * b) / denominator;

    _require(
      result <= BI_MAX_UINT256,
      '',
      { result, BI_MAX_UINT: BI_MAX_UINT256 },
      'result <= BI_MAX_UINT',
    );

    return result;
  }
}
