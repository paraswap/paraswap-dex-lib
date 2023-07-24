import { FEE_UNITS, TWO_FEE_UNITS, TWO_POW_96 } from '../constants';
import { FullMath } from './FullMath';
import { QuadMath } from './QuadMath';

export class SwapMath {
  static computeSwapStep(
    liquidity: bigint,
    currentSqrtP: bigint,
    targetSqrtP: bigint,
    feeInFeeUnits: bigint,
    specifiedAmount: bigint,
    isExactInput: boolean,
    isToken0: boolean,
  ): {
    usedAmount: bigint;
    returnedAmount: bigint;
    deltaL: bigint;
    nextSqrtP: bigint;
  } {
    let nextSqrtP = 0n;
    let deltaL = 0n;
    let returnedAmount = 0n;
    let usedAmount = 0n;

    if (currentSqrtP === targetSqrtP)
      return {
        usedAmount: usedAmount,
        returnedAmount: returnedAmount,
        deltaL: deltaL,
        nextSqrtP: currentSqrtP,
      };

    usedAmount = this.calcReachAmount(
      liquidity,
      currentSqrtP,
      targetSqrtP,
      feeInFeeUnits,
      isExactInput,
      isToken0,
    );

    if (
      (isExactInput && usedAmount > specifiedAmount) ||
      (!isExactInput && usedAmount <= specifiedAmount)
    ) {
      usedAmount = specifiedAmount;
    } else {
      nextSqrtP = targetSqrtP;
    }

    let absDelta =
      usedAmount >= 0 ? usedAmount : BigInt.asUintN(256, -1n * usedAmount);
    if (nextSqrtP == 0n) {
      deltaL = this.estimateIncrementalLiquidity(
        absDelta,
        liquidity,
        currentSqrtP,
        feeInFeeUnits,
        isExactInput,
        isToken0,
      );
      nextSqrtP = BigInt.asUintN(
        160,
        this.calcFinalPrice(
          absDelta,
          liquidity,
          deltaL,
          currentSqrtP,
          isExactInput,
          isToken0,
        ),
      );
    } else {
      deltaL = this.calcIncrementalLiquidity(
        absDelta,
        liquidity,
        currentSqrtP,
        nextSqrtP,
        isExactInput,
        isToken0,
      );
    }
    returnedAmount = this.calcReturnedAmount(
      liquidity,
      currentSqrtP,
      nextSqrtP,
      deltaL,
      isExactInput,
      isToken0,
    );

    return {
      usedAmount: BigInt.asIntN(256, usedAmount),
      returnedAmount: BigInt.asIntN(256, returnedAmount),
      deltaL,
      nextSqrtP: BigInt.asUintN(160, nextSqrtP),
    };
  }

  static calcReachAmount(
    liquidity: bigint,
    currentSqrtP: bigint,
    targetSqrtP: bigint,
    feeInFeeUnits: bigint,
    isExactInput: boolean,
    isToken0: boolean,
  ): bigint {
    let reachAmount = 0n;
    let absPriceDiff: bigint;
    absPriceDiff =
      currentSqrtP >= targetSqrtP
        ? currentSqrtP - targetSqrtP
        : targetSqrtP - currentSqrtP;

    if (isExactInput) {
      if (isToken0) {
        let denominator =
          TWO_FEE_UNITS * targetSqrtP - feeInFeeUnits * currentSqrtP;
        let numerator = FullMath.mulDivFloor(
          liquidity,
          TWO_FEE_UNITS * absPriceDiff,
          denominator,
        );
        reachAmount = BigInt.asIntN(
          256,
          FullMath.mulDivFloor(numerator, TWO_POW_96, currentSqrtP),
        );
      } else {
        let denominator =
          TWO_FEE_UNITS * currentSqrtP - feeInFeeUnits * targetSqrtP;
        let numerator = FullMath.mulDivFloor(
          liquidity,
          TWO_FEE_UNITS * absPriceDiff,
          denominator,
        );
        reachAmount = BigInt.asIntN(
          256,
          FullMath.mulDivFloor(numerator, currentSqrtP, TWO_POW_96),
        );
      }
    } else {
      if (isToken0) {
        // numerator: (liquidity)(absPriceDiff)(2 * currentSqrtP - deltaL * (currentSqrtP + targetSqrtP))
        // denominator: (currentSqrtP * targetSqrtP) * (2 * currentSqrtP - deltaL * targetSqrtP)
        // overflow should not happen because the absPriceDiff is capped to ~5%
        let denominator =
          TWO_FEE_UNITS * currentSqrtP - feeInFeeUnits * targetSqrtP;
        let numerator = denominator - feeInFeeUnits * currentSqrtP;
        numerator = FullMath.mulDivFloor(
          liquidity << 96n,
          numerator,
          denominator,
        );
        reachAmount = BigInt.asIntN(
          256,
          (-1n * FullMath.mulDivFloor(numerator, absPriceDiff, currentSqrtP)) /
            targetSqrtP,
        );
      } else {
        // numerator: liquidity * absPriceDiff * (TWO_FEE_UNITS * targetSqrtP - feeInFeeUnits * (targetSqrtP + currentSqrtP))
        // denominator: (TWO_FEE_UNITS * targetSqrtP - feeInFeeUnits * currentSqrtP)
        // overflow should not happen because the absPriceDiff is capped to ~5%
        let denominator =
          TWO_FEE_UNITS * targetSqrtP - feeInFeeUnits * currentSqrtP;
        let numerator = denominator - feeInFeeUnits * targetSqrtP;
        numerator = FullMath.mulDivFloor(liquidity, numerator, denominator);
        reachAmount = BigInt.asIntN(
          256,
          -1n * FullMath.mulDivFloor(numerator, absPriceDiff, TWO_POW_96),
        );
      }
    }
    return reachAmount;
  }

  static estimateIncrementalLiquidity(
    absDelta: bigint,
    liquidity: bigint,
    currentSqrtP: bigint,
    feeInFeeUnits: bigint,
    isExactInput: boolean,
    isToken0: boolean,
  ): bigint {
    let deltaL = 0n;

    if (isExactInput) {
      if (isToken0) {
        // deltaL = feeInFeeUnits * absDelta * currentSqrtP / 2
        deltaL = FullMath.mulDivFloor(
          currentSqrtP,
          absDelta * feeInFeeUnits,
          TWO_FEE_UNITS << 96n,
        );
      } else {
        // deltaL = feeInFeeUnits * absDelta * / (currentSqrtP * 2)
        // Because nextSqrtP = (liquidity + absDelta / currentSqrtP) * currentSqrtP / (liquidity + deltaL)
        // so we round up deltaL, to round down nextSqrtP
        deltaL = FullMath.mulDivFloor(
          TWO_POW_96,
          absDelta * feeInFeeUnits,
          TWO_FEE_UNITS * currentSqrtP,
        );
      }
    } else {
      // obtain the smaller root of the quadratic equation
      // ax^2 - 2bx + c = 0 such that b > 0, and x denotes deltaL
      let a = feeInFeeUnits;
      let b = (FEE_UNITS - feeInFeeUnits) * liquidity;
      let c = feeInFeeUnits * liquidity * absDelta;
      if (isToken0) {
        // a = feeInFeeUnits
        // b = (FEE_UNITS - feeInFeeUnits) * liquidity - FEE_UNITS * absDelta * currentSqrtP
        // c = feeInFeeUnits * liquidity * absDelta * currentSqrtP
        b -= FullMath.mulDivFloor(
          FEE_UNITS * absDelta,
          currentSqrtP,
          TWO_POW_96,
        );
        c = FullMath.mulDivFloor(c, currentSqrtP, TWO_POW_96);
      } else {
        // a = feeInFeeUnits
        // b = (FEE_UNITS - feeInFeeUnits) * liquidity - FEE_UNITS * absDelta / currentSqrtP
        // c = liquidity * feeInFeeUnits * absDelta / currentSqrtP
        b -= FullMath.mulDivFloor(
          FEE_UNITS * absDelta,
          TWO_POW_96,
          currentSqrtP,
        );
        c = FullMath.mulDivFloor(c, TWO_POW_96, currentSqrtP);
      }
      deltaL = QuadMath.getSmallerRootOfQuadEqn(a, b, c);
    }

    return deltaL;
  }

  static calcIncrementalLiquidity(
    absDelta: bigint,
    liquidity: bigint,
    currentSqrtP: bigint,
    nextSqrtP: bigint,
    isExactInput: boolean,
    isToken0: boolean,
  ): bigint {
    let deltaL = 0n;

    if (isToken0) {
      let tmp1 = FullMath.mulDivFloor(liquidity, TWO_POW_96, currentSqrtP);
      let tmp2 = isExactInput ? tmp1 + absDelta : tmp1 - absDelta;
      let tmp3 = FullMath.mulDivFloor(nextSqrtP, tmp2, TWO_POW_96);

      deltaL = tmp3 > liquidity ? tmp3 - liquidity : 0n;
    } else {
      let tmp1 = FullMath.mulDivFloor(liquidity, currentSqrtP, TWO_POW_96);
      let tmp2 = isExactInput ? tmp1 + absDelta : tmp1 - absDelta;
      let tmp3 = FullMath.mulDivFloor(tmp2, TWO_POW_96, nextSqrtP);

      deltaL = tmp3 > liquidity ? tmp3 - liquidity : 0n;
    }

    return deltaL;
  }

  static calcFinalPrice(
    absDelta: bigint,
    liquidity: bigint,
    deltaL: bigint,
    currentSqrtP: bigint,
    isExactInput: boolean,
    isToken0: boolean,
  ): bigint {
    if (isToken0) {
      let tmp = FullMath.mulDivFloor(absDelta, currentSqrtP, TWO_POW_96);
      if (isExactInput) {
        return FullMath.mulDivCeiling(
          liquidity + deltaL,
          currentSqrtP,
          liquidity + tmp,
        );
      } else {
        return FullMath.mulDivFloor(
          liquidity + deltaL,
          currentSqrtP,
          liquidity - tmp,
        );
      }
    } else {
      let tmp = FullMath.mulDivFloor(absDelta, TWO_POW_96, currentSqrtP);
      if (isExactInput) {
        return FullMath.mulDivFloor(
          liquidity + tmp,
          currentSqrtP,
          liquidity + deltaL,
        );
      } else {
        return FullMath.mulDivCeiling(
          liquidity - tmp,
          currentSqrtP,
          liquidity + deltaL,
        );
      }
    }
  }

  static calcReturnedAmount(
    liquidity: bigint,
    currentSqrtP: bigint,
    nextSqrtP: bigint,
    deltaL: bigint,
    isExactInput: boolean,
    isToken0: boolean,
  ): bigint {
    let returnedAmount = 0n;
    if (isToken0) {
      if (isExactInput) {
        returnedAmount =
          BigInt.asIntN(
            256,
            FullMath.mulDivCeiling(deltaL, nextSqrtP, TWO_POW_96),
          ) +
          BigInt.asIntN(
            256,
            -FullMath.mulDivFloor(
              liquidity,
              currentSqrtP - nextSqrtP,
              TWO_POW_96,
            ),
          );
      } else {
        returnedAmount =
          BigInt.asIntN(
            256,
            FullMath.mulDivCeiling(deltaL, nextSqrtP, TWO_POW_96),
          ) +
          BigInt.asIntN(
            256,
            FullMath.mulDivCeiling(
              liquidity,
              nextSqrtP - currentSqrtP,
              TWO_POW_96,
            ),
          );
      }
    } else {
      returnedAmount =
        BigInt.asIntN(
          256,
          FullMath.mulDivCeiling(liquidity + deltaL, TWO_POW_96, nextSqrtP),
        ) +
        BigInt.asIntN(
          256,
          -FullMath.mulDivFloor(liquidity, TWO_POW_96, currentSqrtP),
        );
    }

    if (isExactInput && returnedAmount == 1n) {
      // rounding make returnedAmount == 1
      returnedAmount = 0n;
    }

    return BigInt.asIntN(256, returnedAmount);
  }
}
