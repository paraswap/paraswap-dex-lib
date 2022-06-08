import { BI_POWS } from '../../../bigint-constants';
import { FullMath } from './FullMath';
import { SqrtPriceMath } from './SqrtPriceMath';

export class SwapMath {
  static computeSwapStep(
    sqrtRatioCurrentX96: bigint,
    sqrtRatioTargetX96: bigint,
    liquidity: bigint,
    amountRemaining: bigint,
    feePips: bigint,
  ): {
    sqrtRatioNextX96: bigint;
    amountIn: bigint;
    amountOut: bigint;
    feeAmount: bigint;
  } {
    const zeroForOne = sqrtRatioCurrentX96 >= sqrtRatioTargetX96;
    const exactIn = amountRemaining >= 0n;

    let sqrtRatioNextX96 = 0n;
    let amountIn = 0n;
    let amountOut = 0n;
    let feeAmount = 0n;

    if (exactIn) {
      const amountRemainingLessFee = FullMath.mulDiv(
        amountRemaining,
        BI_POWS[6] - feePips,
        BI_POWS[6],
      );
      amountIn = zeroForOne
        ? SqrtPriceMath.getAmount0Delta(
            sqrtRatioTargetX96,
            sqrtRatioCurrentX96,
            liquidity,
            true,
          )
        : SqrtPriceMath.getAmount1Delta(
            sqrtRatioCurrentX96,
            sqrtRatioTargetX96,
            liquidity,
            true,
          );
      if (amountRemainingLessFee >= amountIn)
        sqrtRatioNextX96 = sqrtRatioTargetX96;
      else
        sqrtRatioNextX96 = SqrtPriceMath.getNextSqrtPriceFromInput(
          sqrtRatioCurrentX96,
          liquidity,
          amountRemainingLessFee,
          zeroForOne,
        );
    } else {
      amountOut = zeroForOne
        ? SqrtPriceMath.getAmount1Delta(
            sqrtRatioTargetX96,
            sqrtRatioCurrentX96,
            liquidity,
            false,
          )
        : SqrtPriceMath.getAmount0Delta(
            sqrtRatioCurrentX96,
            sqrtRatioTargetX96,
            liquidity,
            false,
          );
      if (-amountRemaining >= amountOut) sqrtRatioNextX96 = sqrtRatioTargetX96;
      else
        sqrtRatioNextX96 = SqrtPriceMath.getNextSqrtPriceFromOutput(
          sqrtRatioCurrentX96,
          liquidity,
          -amountRemaining,
          zeroForOne,
        );
    }

    const max = sqrtRatioTargetX96 == sqrtRatioNextX96;

    if (zeroForOne) {
      amountIn =
        max && exactIn
          ? amountIn
          : SqrtPriceMath.getAmount0Delta(
              sqrtRatioNextX96,
              sqrtRatioCurrentX96,
              liquidity,
              true,
            );
      amountOut =
        max && !exactIn
          ? amountOut
          : SqrtPriceMath.getAmount1Delta(
              sqrtRatioNextX96,
              sqrtRatioCurrentX96,
              liquidity,
              false,
            );
    } else {
      amountIn =
        max && exactIn
          ? amountIn
          : SqrtPriceMath.getAmount1Delta(
              sqrtRatioCurrentX96,
              sqrtRatioNextX96,
              liquidity,
              true,
            );
      amountOut =
        max && !exactIn
          ? amountOut
          : SqrtPriceMath.getAmount0Delta(
              sqrtRatioCurrentX96,
              sqrtRatioNextX96,
              liquidity,
              false,
            );
    }

    // cap the output amount to not exceed the remaining output amount
    if (!exactIn && amountOut > -amountRemaining) {
      amountOut = -amountRemaining;
    }

    if (exactIn && sqrtRatioNextX96 != sqrtRatioTargetX96) {
      // we didn't reach the target, so take the remainder of the maximum input as fee
      feeAmount = amountRemaining - amountIn;
    } else {
      feeAmount = FullMath.mulDivRoundingUp(
        amountIn,
        feePips,
        BI_POWS[6] - feePips,
      );
    }

    return { sqrtRatioNextX96, amountIn, amountOut, feeAmount };
  }
}
