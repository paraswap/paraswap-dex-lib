import { BI_POWS } from '../../../../bigint-constants';
import { MathSol } from '../../balancer-v2-math';

const AMP_PRECISION = BI_POWS[3];

export function _calculateInvariant(
  amp: bigint,
  balances: bigint[],
  roundUp: boolean,
): bigint {
  /**********************************************************************************************
   // invariant                                                                                 //
   // D = invariant                                                  D^(n+1)                    //
   // A = amplification coefficient      A  n^n S + D = A D n^n + -----------                   //
   // S = sum of balances                                             n^n P                     //
   // P = product of balances                                                                   //
   // n = number of tokens                                                                      //
   *********x************************************************************************************/

    // We support rounding up or down.

  let sum = 0n;
  const numTokens = balances.length;
  for (let i = 0; i < numTokens; i++) {
    sum = sum + balances[i];
  }
  if (sum == 0n) {
    return 0n;
  }

  let prevInvariant = 0n;
  let invariant = sum;
  const ampTimesTotal = amp * BigInt(numTokens);

  for (let i = 0; i < 255; i++) {
    let P_D = balances[0] * BigInt(numTokens);
    for (let j = 1; j < numTokens; j++) {
      P_D = MathSol.div(
        MathSol.mul(MathSol.mul(P_D, balances[j]), BigInt(numTokens)),
        invariant,
        roundUp,
      );
    }
    prevInvariant = invariant;
    invariant = MathSol.div(
      MathSol.mul(MathSol.mul(BigInt(numTokens), invariant), invariant) +
      MathSol.div(
        MathSol.mul(MathSol.mul(ampTimesTotal, sum), P_D),
        AMP_PRECISION,
        roundUp,
      ),
      MathSol.mul(BigInt(numTokens + 1), invariant) +
      // No need to use checked arithmetic for the amp precision, the amp is guaranteed to be at least 1
      MathSol.div(
        MathSol.mul(ampTimesTotal - AMP_PRECISION, P_D),
        AMP_PRECISION,
        !roundUp,
      ),
      roundUp,
    );

    if (invariant > prevInvariant) {
      if (invariant - prevInvariant <= 1) {
        return invariant;
      }
    } else if (prevInvariant - invariant <= 1) {
      return invariant;
    }
  }

  throw new Error('Errors.STABLE_INVARIANT_DIDNT_CONVERGE');
}

// PairType = 'token->token'
// SwapType = 'swapExactIn'
export function _calcOutGivenIn(
  amp: bigint,
  balances: bigint[],
  tokenIndexIn: number,
  tokenIndexOut: number,
  amountIn: bigint,
  invariant?: bigint,
): bigint {
  /**************************************************************************************************************
   // outGivenIn token x for y - polynomial equation to solve                                                   //
   // ay = amount out to calculate                                                                              //
   // by = balance token out                                                                                    //
   // y = by - ay (finalBalanceOut)                                                                             //
   // D = invariant                                               D                     D^(n+1)                 //
   // A = amplification coefficient               y^2 + ( S - ----------  - D) * y -  ------------- = 0         //
   // n = number of tokens                                    (A * n^n)               A * n^2n * P              //
   // S = sum of final balances but y                                                                           //
   // P = product of final balances but y                                                                       //
   **************************************************************************************************************/
  balances = [...balances];
  // Given that we need to have a greater final balance out, the invariant needs to be rounded up
  if (!invariant) invariant = _calculateInvariant(amp, balances, true);

  const initBalance = balances[tokenIndexIn];
  balances[tokenIndexIn] = initBalance + amountIn;
  const finalBalanceOut = _getTokenBalanceGivenInvariantAndAllOtherBalances(
    amp,
    balances,
    invariant,
    tokenIndexOut,
  );
  return balances[tokenIndexOut] - finalBalanceOut - 1n;
}

export function _calcInGivenOut(
  amp: bigint,
  balances: bigint[],
  tokenIndexIn: number,
  tokenIndexOut: number,
  amountOut: bigint,
  fee: bigint,
  invariant?: bigint,
): bigint {
  /**************************************************************************************************************
   // inGivenOut token x for y - polynomial equation to solve                                                   //
   // ax = amount in to calculate                                                                               //
   // bx = balance token in                                                                                     //
   // x = bx + ax (finalBalanceIn)                                                                              //
   // D = invariant                                                D                     D^(n+1)                //
   // A = amplification coefficient               x^2 + ( S - ----------  - D) * x -  ------------- = 0         //
   // n = number of tokens                                     (A * n^n)               A * n^2n * P             //
   // S = sum of final balances but x                                                                           //
   // P = product of final balances but x                                                                       //
   **************************************************************************************************************/

  // Given that we need to have a greater final balance in, the invariant needs to be rounded up
  balances = [...balances];
  if (!invariant) invariant = _calculateInvariant(amp, balances, true);
  balances[tokenIndexOut] = MathSol.sub(balances[tokenIndexOut], amountOut);

  const finalBalanceIn = _getTokenBalanceGivenInvariantAndAllOtherBalances(
    amp,
    balances,
    invariant,
    tokenIndexIn,
  );

  let amountIn = MathSol.add(
    MathSol.sub(finalBalanceIn, balances[tokenIndexIn]),
    1n,
  );

  amountIn = addFee(amountIn, fee);
  return amountIn;
}

export function _calcBptOutGivenExactTokensIn(
  amp: bigint,
  balances: bigint[],
  amountsIn: bigint[],
  bptTotalSupply: bigint,
  invariant?: bigint,
): bigint {
  if (!invariant) invariant = _calculateInvariant(amp, balances, true);
  // BPT out, so we round down overall.

  // First loop calculates the sum of all token balances, which will be used to calculate
  // the current weights of each token, relative to this sum
  let sumBalances = 0n;
  for (let i = 0; i < balances.length; i++) {
    sumBalances = sumBalances + balances[i];
  }

  // Calculate the weighted balance ratio without considering fees
  const balanceRatiosWithFee: bigint[] = new Array(amountsIn.length);
  // The weighted sum of token balance ratios with fee
  let invariantRatioWithFees = 0n;
  for (let i = 0; i < balances.length; i++) {
    const currentWeight = MathSol.divDownFixed(balances[i], sumBalances);
    balanceRatiosWithFee[i] = MathSol.divDownFixed(
      balances[i] + amountsIn[i],
      balances[i],
    );
    invariantRatioWithFees =
      invariantRatioWithFees +
      MathSol.mulDownFixed(balanceRatiosWithFee[i], currentWeight);
  }

  // Second loop calculates new amounts in, taking into account the fee on the percentage excess
  const newBalances: bigint[] = new Array(balances.length);
  for (let i = 0; i < balances.length; i++) {
    let amountInWithoutFee: bigint;

    // Check if the balance ratio is greater than the ideal ratio to charge fees or not
    if (balanceRatiosWithFee[i] > invariantRatioWithFees) {
      const nonTaxableAmount = MathSol.mulDownFixed(
        balances[i],
        invariantRatioWithFees - MathSol.ONE,
      );
      const taxableAmount = amountsIn[i] - nonTaxableAmount;
      // No need to use checked arithmetic for the swap fee, it is guaranteed to be lower than 50%
      // amountInWithoutFee =
      //     nonTaxableAmount +
      //     MathSol.mulDownFixed(
      //         taxableAmount,
      //         MathSol.ONE - swapFeePercentage
      //     );
      amountInWithoutFee = nonTaxableAmount + taxableAmount;
    } else {
      amountInWithoutFee = amountsIn[i];
    }
    newBalances[i] = balances[i] + amountInWithoutFee;
  }

  // Get current and new invariants, taking swap fees into account
  const currentInvariant = _calculateInvariant(amp, balances, true);
  const newInvariant = _calculateInvariant(amp, newBalances, false);
  const invariantRatio = MathSol.divDownFixed(newInvariant, currentInvariant);

  // If the invariant didn't increase for any reason, we simply don't mint BPT
  if (invariantRatio > MathSol.ONE) {
    return MathSol.mulDownFixed(bptTotalSupply, invariantRatio - MathSol.ONE);
  } else {
    return 0n;
  }
}

export function _calcTokenInGivenExactBptOut(
  amp: bigint,
  balances: bigint[],
  tokenIndexIn: number,
  bptAmountOut: bigint,
  bptTotalSupply: bigint,
  fee: bigint,
  invariant?: bigint,
): bigint {
  if (!invariant) invariant = _calculateInvariant(amp, balances, true);

  const newInvariant = MathSol.mulUpFixed(
    MathSol.divUpFixed(
      MathSol.add(bptTotalSupply, bptAmountOut),
      bptTotalSupply
    ),
    invariant
  );

  const newBalanceTokenIndex =
    _getTokenBalanceGivenInvariantAndAllOtherBalances(
      amp,
      balances,
      newInvariant,
      tokenIndexIn
    );
  const amountInWithoutFee = MathSol.sub(
    newBalanceTokenIndex,
    balances[tokenIndexIn]
  );

  let sumBalances = BigInt(0);
  for (let i = 0; i < balances.length; i++) {
    sumBalances = MathSol.add(sumBalances, balances[i]);
  }

  // We can now compute how much extra balance is being deposited
  // and used in virtual swaps, and charge swap fees accordingly.
  const currentWeight = MathSol.divDownFixed(
    balances[tokenIndexIn],
    sumBalances
  );
  const taxablePercentage = MathSol.complementFixed(currentWeight);
  const taxableAmount = MathSol.mulUpFixed(
    amountInWithoutFee,
    taxablePercentage
  );
  const nonTaxableAmount = MathSol.sub(amountInWithoutFee, taxableAmount);

  return MathSol.add(
    nonTaxableAmount,
    MathSol.divUpFixed(taxableAmount, MathSol.sub(MathSol.ONE, fee))
  );
}

/*
Flow of calculations:
amountsTokenOut -> amountsOutProportional ->
amountOutPercentageExcess -> amountOutBeforeFee -> newInvariant -> amountBPTIn
*/
export function _calcBptInGivenExactTokensOut(
  amp: bigint,
  balances: bigint[],
  amountsOut: bigint[],
  bptTotalSupply: bigint,
  swapFeePercentage: bigint,
  invariant?: bigint,
): bigint {
  if (!invariant) invariant = _calculateInvariant(amp, balances, true);
  // BPT in, so we round up overall.

  // First loop calculates the sum of all token balances, which will be used to calculate
  // the current weights of each token relative to this sum
  let sumBalances = 0n;
  for (let i = 0; i < balances.length; i++) {
    sumBalances = sumBalances + balances[i];
  }

  // Calculate the weighted balance ratio without considering fees
  const balanceRatiosWithoutFee: bigint[] = new Array(amountsOut.length);
  let invariantRatioWithoutFees = 0n;
  for (let i = 0; i < balances.length; i++) {
    const currentWeight = MathSol.divUpFixed(balances[i], sumBalances);
    balanceRatiosWithoutFee[i] = MathSol.divUpFixed(
      balances[i] - amountsOut[i],
      balances[i],
    );
    invariantRatioWithoutFees =
      invariantRatioWithoutFees +
      MathSol.mulUpFixed(balanceRatiosWithoutFee[i], currentWeight);
  }

  // Second loop calculates new amounts in, taking into account the fee on the percentage excess
  const newBalances: bigint[] = new Array(balances.length);
  for (let i = 0; i < balances.length; i++) {
    // Swap fees are typically charged on 'token in', but there is no 'token in' here, so we apply it to
    // 'token out'. This results in slightly larger price impact.

    let amountOutWithFee: bigint;
    if (invariantRatioWithoutFees > balanceRatiosWithoutFee[i]) {
      const nonTaxableAmount = MathSol.mulDownFixed(
        balances[i],
        MathSol.complementFixed(invariantRatioWithoutFees),
      );
      const taxableAmount = amountsOut[i] - nonTaxableAmount;
      // No need to use checked arithmetic for the swap fee, it is guaranteed to be lower than 50%
      amountOutWithFee =
        nonTaxableAmount +
        MathSol.divUpFixed(taxableAmount, MathSol.ONE - swapFeePercentage);
    } else {
      amountOutWithFee = amountsOut[i];
    }
    newBalances[i] = balances[i] - amountOutWithFee;
  }

  // Get current and new invariants, taking into account swap fees
  const currentInvariant = _calculateInvariant(amp, balances, true);
  const newInvariant = _calculateInvariant(amp, newBalances, false);
  const invariantRatio = MathSol.divDownFixed(newInvariant, currentInvariant);

  // return amountBPTIn
  return MathSol.mulUpFixed(
    bptTotalSupply,
    MathSol.complementFixed(invariantRatio),
  );
}

export function _calcTokenOutGivenExactBptIn(
  amp: bigint,
  balances: bigint[],
  tokenIndex: number,
  bptAmountIn: bigint,
  bptTotalSupply: bigint,
  invariant?: bigint,
): bigint {
  if (!invariant) invariant = _calculateInvariant(amp, balances, true);
  // Token out, so we round down overall.

  // Get the current and new invariants. Since we need a bigger new invariant, we round the current one up.
  const currentInvariant = _calculateInvariant(amp, balances, true);
  const newInvariant = MathSol.mulUpFixed(
    MathSol.divUpFixed(bptTotalSupply - bptAmountIn, bptTotalSupply),
    currentInvariant,
  );

  // Calculate amount out without fee
  const newBalanceTokenIndex =
    _getTokenBalanceGivenInvariantAndAllOtherBalances(
      amp,
      balances,
      newInvariant,
      tokenIndex,
    );
  const amountOutWithoutFee = balances[tokenIndex] - newBalanceTokenIndex;

  // First calculate the sum of all token balances, which will be used to calculate
  // the current weight of each token
  let sumBalances = 0n;
  for (let i = 0; i < balances.length; i++) {
    sumBalances = sumBalances + balances[i];
  }

  // We can now compute how much excess balance is being withdrawn as a result of the virtual swaps, which result
  // in swap fees.
  const currentWeight = MathSol.divDownFixed(balances[tokenIndex], sumBalances);
  const taxablePercentage = MathSol.complementFixed(currentWeight);

  // Swap fees are typically charged on 'token in', but there is no 'token in' here, so we apply it
  // to 'token out'. This results in slightly larger price impact. Fees are rounded up.
  const taxableAmount = MathSol.mulUpFixed(
    amountOutWithoutFee,
    taxablePercentage,
  );
  const nonTaxableAmount = amountOutWithoutFee - taxableAmount;

  // No need to use checked arithmetic for the swap fee, it is guaranteed to be lower than 50%
  return nonTaxableAmount + taxableAmount;
}

export function _calcTokensOutGivenExactBptIn(
  balances: bigint[],
  bptAmountIn: bigint,
  bptTotalSupply: bigint,
): bigint[] {
  /**********************************************************************************************
    // exactBPTInForTokensOut                                                                    //
    // (per token)                                                                               //
    // aO = tokenAmountOut             /        bptIn         \                                  //
    // b = tokenBalance      a0 = b * | ---------------------  |                                 //
    // bptIn = bptAmountIn             \     bptTotalSupply    /                                 //
    // bpt = bptTotalSupply                                                                      //
    **********************************************************************************************/

  // Since we're computing an amount out, we round down overall. This means rounding down on both the
  // multiplication and division.

  const bptRatio = MathSol.divDownFixed(bptAmountIn, bptTotalSupply);

  const amountsOut: bigint[] = new Array(balances.length);
  for (let i = 0; i < balances.length; i++) {
    amountsOut[i] = MathSol.mulDownFixed(balances[i], bptRatio);
  }

  return amountsOut;
}

function _getTokenBalanceGivenInvariantAndAllOtherBalances(
  amp: bigint,
  balances: bigint[],
  invariant: bigint,
  tokenIndex: number,
): bigint {
  // Rounds result up overall

  const ampTimesTotal = amp * BigInt(balances.length);
  let sum = balances[0];
  let P_D = balances[0] * BigInt(balances.length);
  for (let j = 1; j < balances.length; j++) {
    P_D = MathSol.divDown(
      MathSol.mul(MathSol.mul(P_D, balances[j]), BigInt(balances.length)),
      invariant,
    );
    sum = sum + balances[j];
  }
  // No need to use safe math, based on the loop above `sum` is greater than or equal to `balances[tokenIndex]`
  sum = sum - balances[tokenIndex];

  const inv2 = MathSol.mul(invariant, invariant);
  // We remove the balance fromm c by multiplying it
  const c = MathSol.mul(
    MathSol.mul(
      MathSol.divUp(inv2, MathSol.mul(ampTimesTotal, P_D)),
      AMP_PRECISION,
    ),
    balances[tokenIndex],
  );
  const b =
    sum + MathSol.mul(MathSol.divDown(invariant, ampTimesTotal), AMP_PRECISION);

  // We iterate to find the balance
  let prevTokenBalance = 0n;
  // We multiply the first iteration outside the loop with the invariant to set the value of the
  // initial approximation.
  let tokenBalance = MathSol.divUp(inv2 + c, invariant + b);

  for (let i = 0; i < 255; i++) {
    prevTokenBalance = tokenBalance;

    tokenBalance = MathSol.divUp(
      MathSol.mul(tokenBalance, tokenBalance) + c,
      MathSol.mul(tokenBalance, 2n) + b - invariant,
    );

    if (tokenBalance > prevTokenBalance) {
      if (tokenBalance - prevTokenBalance <= 1) {
        return tokenBalance;
      }
    } else if (prevTokenBalance - tokenBalance <= 1) {
      return tokenBalance;
    }
  }
  throw new Error('Errors.STABLE_GET_BALANCE_DIDNT_CONVERGE');
}

export function subtractFee(amount: bigint, fee: bigint): bigint {
  const feeAmount = MathSol.mulUpFixed(amount, fee);
  return amount - feeAmount;
}

export function addFee(amount: bigint, fee: bigint): bigint {
  return MathSol.divUpFixed(amount, MathSol.complementFixed(fee));
}
