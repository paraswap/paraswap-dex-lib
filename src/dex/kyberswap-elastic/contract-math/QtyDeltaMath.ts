import { TWO_POW_96 } from '../constants';
import { FullMath } from './FullMath';
import { SafeCast } from './SafeCast';

export class QtyDeltaMath {
  static calcRequiredQty0(
    lowerSqrtP: bigint,
    upperSqrtP: bigint,
    liquidity: bigint,
    isAdd: boolean,
  ): bigint {
    let numerator1 = liquidity << 96n;
    let numerator2 = upperSqrtP - lowerSqrtP;

    return isAdd
      ? SafeCast.toInt256(
          this.divCeil(
            FullMath.mulDivCeil(numerator1, numerator2, upperSqrtP),
            lowerSqrtP,
          ),
        )
      : SafeCast.revToInt256(
          FullMath.mulDivFloor(numerator1, numerator2, upperSqrtP) / lowerSqrtP,
        );
  }

  static calcRequiredQty1(
    lowerSqrtP: bigint,
    upperSqrtP: bigint,
    liquidity: bigint,
    isAdd: boolean,
  ): bigint {
    return isAdd
      ? SafeCast.toInt256(
          FullMath.mulDivCeil(liquidity, upperSqrtP - lowerSqrtP, TWO_POW_96),
        )
      : SafeCast.revToInt256(
          FullMath.mulDivFloor(liquidity, upperSqrtP - lowerSqrtP, TWO_POW_96),
        );
  }

  static divCeil(a: bigint, b: bigint): bigint {
    return (a + b - 1n) / b;
  }
}
