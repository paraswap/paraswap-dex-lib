import { BI_MAX_UINT160 } from '../../../bigint-constants';
import { FixedPoint96 } from './FixedPoint96';
import { FullMath } from './FullMath';
import { UnsafeMath } from './UnsafeMath';
import { _require } from '../../../utils';

export class SqrtPriceMath {
  static getNextSqrtPriceFromAmount0RoundingUp(
    sqrtPX96: bigint,
    liquidity: bigint,
    amount: bigint,
    add: boolean,
  ): bigint {
    if (amount === 0n) return sqrtPX96;
    const numerator1 =
      BigInt.asUintN(256, liquidity) << FixedPoint96.RESOLUTION;

    const product = amount * sqrtPX96;
    if (add) {
      if (product / amount === sqrtPX96) {
        const denominator = numerator1 + product;
        if (denominator >= numerator1) {
          return BigInt.asUintN(
            160,
            FullMath.mulDivCeil(numerator1, sqrtPX96, denominator),
          );
        }
      }
      return BigInt.asUintN(
        160,
        UnsafeMath.divRoundingUp(numerator1, numerator1 / sqrtPX96 + amount),
      );
    } else {
      _require(
        product / amount === sqrtPX96 && numerator1 > product,
        '',
        { product, amount, sqrtPX96, numerator1 },
        'product / amount === sqrtPX96 && numerator1 > product',
      );
      const denominator = numerator1 - product;
      return BigInt.asUintN(
        160,
        FullMath.mulDivCeil(numerator1, sqrtPX96, denominator),
      );
    }
  }

  static getNextSqrtPriceFromAmount1RoundingDown(
    sqrtPX96: bigint,
    liquidity: bigint,
    amount: bigint,
    add: boolean,
  ): bigint {
    if (add) {
      const quotient =
        amount <= BI_MAX_UINT160
          ? (amount << FixedPoint96.RESOLUTION) / liquidity
          : FullMath.mulDiv(amount, FixedPoint96.Q96, liquidity);
      return BigInt.asUintN(160, BigInt.asUintN(256, sqrtPX96) + quotient);
    } else {
      const quotient =
        amount <= BI_MAX_UINT160
          ? UnsafeMath.divRoundingUp(
              amount << FixedPoint96.RESOLUTION,
              liquidity,
            )
          : FullMath.mulDivCeil(amount, FixedPoint96.Q96, liquidity);

      _require(
        sqrtPX96 > quotient,
        '',
        { sqrtPX96, quotient },
        'sqrtPX96 > quotient',
      );
      return BigInt.asUintN(160, sqrtPX96 - quotient);
    }
  }

  static getNextSqrtPriceFromInput(
    sqrtPX96: bigint,
    liquidity: bigint,
    amountIn: bigint,
    zeroForOne: boolean,
  ): bigint {
    _require(sqrtPX96 > 0n, '', { sqrtPX96 }, 'sqrtPX96 > 0n');
    _require(liquidity > 0n, '', { liquidity }, 'liquidity > 0n');

    return zeroForOne
      ? SqrtPriceMath.getNextSqrtPriceFromAmount0RoundingUp(
          sqrtPX96,
          liquidity,
          amountIn,
          true,
        )
      : SqrtPriceMath.getNextSqrtPriceFromAmount1RoundingDown(
          sqrtPX96,
          liquidity,
          amountIn,
          true,
        );
  }

  static getNextSqrtPriceFromOutput(
    sqrtPX96: bigint,
    liquidity: bigint,
    amountOut: bigint,
    zeroForOne: boolean,
  ): bigint {
    _require(sqrtPX96 > 0n, '', { sqrtPX96 }, 'sqrtPX96 > 0n');
    _require(liquidity > 0n, '', { liquidity }, 'liquidity > 0n');

    return zeroForOne
      ? SqrtPriceMath.getNextSqrtPriceFromAmount1RoundingDown(
          sqrtPX96,
          liquidity,
          amountOut,
          false,
        )
      : SqrtPriceMath.getNextSqrtPriceFromAmount0RoundingUp(
          sqrtPX96,
          liquidity,
          amountOut,
          false,
        );
  }

  static getAmount0Delta(
    sqrtRatioAX96: bigint,
    sqrtRatioBX96: bigint,
    liquidity: bigint,
    roundUp: boolean,
  ) {
    if (sqrtRatioAX96 > sqrtRatioBX96) {
      [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
    }

    const numerator1 =
      BigInt.asUintN(256, liquidity) << FixedPoint96.RESOLUTION;
    const numerator2 = sqrtRatioBX96 - sqrtRatioAX96;

    _require(sqrtRatioAX96 > 0, '', { sqrtRatioAX96 }, 'sqrtRatioAX96 > 0');

    return roundUp
      ? UnsafeMath.divRoundingUp(
          FullMath.mulDivCeil(numerator1, numerator2, sqrtRatioBX96),
          sqrtRatioAX96,
        )
      : FullMath.mulDiv(numerator1, numerator2, sqrtRatioBX96) / sqrtRatioAX96;
  }

  static getAmount1Delta(
    sqrtRatioAX96: bigint,
    sqrtRatioBX96: bigint,
    liquidity: bigint,
    roundUp: boolean,
  ) {
    if (sqrtRatioAX96 > sqrtRatioBX96)
      [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];

    return roundUp
      ? FullMath.mulDivCeil(
          liquidity,
          sqrtRatioBX96 - sqrtRatioAX96,
          FixedPoint96.Q96,
        )
      : FullMath.mulDiv(
          liquidity,
          sqrtRatioBX96 - sqrtRatioAX96,
          FixedPoint96.Q96,
        );
  }

  // Overloaded with different argument numbers
  static _getAmount0DeltaO(
    sqrtRatioAX96: bigint,
    sqrtRatioBX96: bigint,
    liquidity: bigint,
  ) {
    return liquidity < 0
      ? -BigInt.asIntN(
          256,
          SqrtPriceMath.getAmount0Delta(
            sqrtRatioAX96,
            sqrtRatioBX96,
            BigInt.asUintN(128, -liquidity),
            false,
          ),
        )
      : BigInt.asIntN(
          256,
          SqrtPriceMath.getAmount0Delta(
            sqrtRatioAX96,
            sqrtRatioBX96,
            BigInt.asUintN(128, liquidity),
            true,
          ),
        );
  }

  // Overloaded with different argument numbers
  static _getAmount1DeltaO(
    sqrtRatioAX96: bigint,
    sqrtRatioBX96: bigint,
    liquidity: bigint,
  ) {
    return liquidity < 0
      ? -BigInt.asIntN(
          256,
          SqrtPriceMath.getAmount1Delta(
            sqrtRatioAX96,
            sqrtRatioBX96,
            BigInt.asUintN(128, -liquidity),
            false,
          ),
        )
      : BigInt.asIntN(
          256,
          SqrtPriceMath.getAmount1Delta(
            sqrtRatioAX96,
            sqrtRatioBX96,
            BigInt.asUintN(128, liquidity),
            true,
          ),
        );
  }
}
