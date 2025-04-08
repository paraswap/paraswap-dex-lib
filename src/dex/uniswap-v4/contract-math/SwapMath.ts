import { BI_POWS } from '../../../bigint-constants';
import { FullMath } from './FullMath';
import { SqrtPriceMath } from './SqrtPriceMath';

export class SwapMath {
  static readonly MAX_SWAP_FEE = BI_POWS[6];

  static getSqrtPriceTarget(
    zeroForOne: boolean,
    sqrtPriceNextX96: bigint,
    sqrtPriceLimitX96: bigint,
  ): bigint {
    // const MAX_UINT160 = BigInt('0xffffffffffffffffffffffffffffffffffffffff');
    //
    // sqrtPriceNextX96 &= MAX_UINT160;
    // sqrtPriceLimitX96 &= MAX_UINT160;
    //
    // const nextOrLimit = Number(
    //   sqrtPriceNextX96 < sqrtPriceLimitX96 !== zeroForOne,
    // );
    // const symDiff = sqrtPriceNextX96 ^ sqrtPriceLimitX96;
    //
    // return sqrtPriceLimitX96 ^ (symDiff * BigInt(nextOrLimit));
    //
    // const nextOrLimit = sqrtPriceNextX96 < sqrtPriceLimitX96 !== zeroForOne;
    // return nextOrLimit ? sqrtPriceLimitX96 : sqrtPriceNextX96;

    const nextOrLimit =
      (sqrtPriceNextX96 < sqrtPriceLimitX96 ? 1 : 0) ^ (zeroForOne ? 1 : 0);

    const symDiff = sqrtPriceNextX96 ^ sqrtPriceLimitX96;
    return sqrtPriceLimitX96 ^ (symDiff * BigInt(nextOrLimit));
  }

  static computeSwapStep(
    sqrtPriceCurrentX96: bigint,
    sqrtPriceTargetX96: bigint,
    liquidity: bigint,
    amountRemaining: bigint,
    feePips: bigint,
  ): {
    sqrtPriceNextX96: bigint;
    amountIn: bigint;
    amountOut: bigint;
    feeAmount: bigint;
  } {
    const _feePips = feePips;
    const zeroForOne = sqrtPriceCurrentX96 >= sqrtPriceTargetX96;
    const exactIn = amountRemaining < 0n;

    let amountIn: bigint = 0n;
    let amountOut: bigint = 0n;
    let feeAmount: bigint = 0n;
    let sqrtPriceNextX96: bigint;

    if (exactIn) {
      const amountRemainingLessFee =
        (BigInt(-amountRemaining) * (SwapMath.MAX_SWAP_FEE - _feePips)) /
        SwapMath.MAX_SWAP_FEE;

      amountIn = zeroForOne
        ? SqrtPriceMath.getAmount0Delta(
            sqrtPriceTargetX96,
            sqrtPriceCurrentX96,
            liquidity,
            true,
          )
        : SqrtPriceMath.getAmount1Delta(
            sqrtPriceCurrentX96,
            sqrtPriceTargetX96,
            liquidity,
            true,
          );

      if (amountRemainingLessFee >= amountIn) {
        sqrtPriceNextX96 = sqrtPriceTargetX96;
        feeAmount =
          _feePips === SwapMath.MAX_SWAP_FEE
            ? amountIn
            : (amountIn * _feePips + (SwapMath.MAX_SWAP_FEE - _feePips - 1n)) /
              (SwapMath.MAX_SWAP_FEE - _feePips);
      } else {
        amountIn = amountRemainingLessFee;
        sqrtPriceNextX96 = SqrtPriceMath.getNextSqrtPriceFromInput(
          sqrtPriceCurrentX96,
          liquidity,
          amountRemainingLessFee,
          zeroForOne,
        );
        feeAmount = BigInt(-amountRemaining) - amountIn;
      }
      amountOut = zeroForOne
        ? SqrtPriceMath.getAmount1Delta(
            sqrtPriceNextX96,
            sqrtPriceCurrentX96,
            liquidity,
            false,
          )
        : SqrtPriceMath.getAmount0Delta(
            sqrtPriceCurrentX96,
            sqrtPriceNextX96,
            liquidity,
            false,
          );
    } else {
      amountOut = zeroForOne
        ? SqrtPriceMath.getAmount1Delta(
            sqrtPriceTargetX96,
            sqrtPriceCurrentX96,
            liquidity,
            false,
          )
        : SqrtPriceMath.getAmount0Delta(
            sqrtPriceCurrentX96,
            sqrtPriceTargetX96,
            liquidity,
            false,
          );

      if (BigInt(amountRemaining) >= amountOut) {
        sqrtPriceNextX96 = sqrtPriceTargetX96;
      } else {
        amountOut = BigInt(amountRemaining);
        sqrtPriceNextX96 = SqrtPriceMath.getNextSqrtPriceFromOutput(
          sqrtPriceCurrentX96,
          liquidity,
          amountOut,
          zeroForOne,
        );
      }
      amountIn = zeroForOne
        ? SqrtPriceMath.getAmount0Delta(
            sqrtPriceNextX96,
            sqrtPriceCurrentX96,
            liquidity,
            true,
          )
        : SqrtPriceMath.getAmount1Delta(
            sqrtPriceCurrentX96,
            sqrtPriceNextX96,
            liquidity,
            true,
          );

      feeAmount =
        (amountIn * _feePips + (SwapMath.MAX_SWAP_FEE - _feePips - 1n)) /
        (SwapMath.MAX_SWAP_FEE - _feePips);
    }

    return { sqrtPriceNextX96, amountIn, amountOut, feeAmount };
  }
}
