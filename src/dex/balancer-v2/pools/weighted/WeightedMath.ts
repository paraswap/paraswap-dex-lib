import { MathSol } from '../../balancer-v2-math';

const _require = (b: boolean, message: string) => {
  if (!b) throw new Error(message);
};

export class WeightedMath {
  static _MAX_IN_RATIO = 300000000000000000n;
  static _MAX_OUT_RATIO = 300000000000000000n;

  static _calcInGivenOut(
    balanceIn: bigint,
    weightIn: bigint,
    balanceOut: bigint,
    weightOut: bigint,
    amountsOut: bigint[],
  ): bigint[] {
    /* https://docs.balancer.fi/reference/math/weighted-math.html#ingivenout */
    /**********************************************************************************************
    // outGivenOut                                                                              //
    // aI = amountIn                                                                            //
    // bI = balanceIn                                                                           //
    // bO = balanceOut              /  /            bO             \    (wO / wI)     \         //
    // aO = amountOut    aI = bI * |  | -------------------------- | ^            - 1  |        //
    // wI = weightIn               \  \       ( bO - aO )         /                   /         //
    // wO = weightOut                                                                           //
    *********************************************************************************************/
    const exponent = MathSol.divUpFixed(weightOut, weightIn);
    return amountsOut.map(amountOut => {
      _require(
        amountOut <= MathSol.mulDownFixed(balanceOut, this._MAX_OUT_RATIO),
        'Errors.MAX_OUT_RATIO',
      );

      const denominator = balanceOut - amountOut;
      const base = MathSol.divUpFixed(balanceOut, denominator);
      const power = MathSol.powUpFixed(base, exponent);
      const ratio = MathSol.sub(power, MathSol.ONE);

      return MathSol.mulUpFixed(balanceIn, ratio);
    });
  }

  // Computes how many tokens can be taken out of a pool if `amountIn` are sent, given the
  // current balances and weights.
  static _calcOutGivenIn(
    balanceIn: bigint,
    weightIn: bigint,
    balanceOut: bigint,
    weightOut: bigint,
    amountsIn: bigint[],
  ): bigint[] {
    /* https://docs.balancer.fi/reference/math/weighted-math.html#outgivenin */
    /**********************************************************************************************
   // outGivenIn                                                                                //
   // aO = amountOut                                                                            //
   // bO = balanceOut                                                                           //
   // bI = balanceIn              /      /            bI             \    (wI / wO) \           //
   // aI = amountIn    aO = bO * |  1 - | --------------------------  | ^            |          //
   // wI = weightIn               \      \       ( bI + aI )         /              /           //
   // wO = weightOut                                                                            //
   **********************************************************************************************/

    // Amount out, so we round down overall.

    // The multiplication rounds down, and the subtrahend (power) rounds up (so the base rounds up too).
    // Because bI / (bI + aI) <= 1, the exponent rounds down.

    // Cannot exceed maximum in ratio

    const exponent = MathSol.divDownFixed(weightIn, weightOut);
    return amountsIn.map(amountIn => {
      _require(
        amountIn <= MathSol.mulDownFixed(balanceIn, this._MAX_IN_RATIO),
        'Errors.MAX_IN_RATIO',
      );
      const denominator = balanceIn + amountIn;
      const base = MathSol.divUpFixed(balanceIn, denominator);
      const power = MathSol.powUpFixed(base, exponent);

      return MathSol.mulDownFixed(balanceOut, MathSol.complementFixed(power));
    });
  }
}
