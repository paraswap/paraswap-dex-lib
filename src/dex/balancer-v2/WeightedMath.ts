import { MathSol } from './balancer-v2-math';

const _require = (b: boolean, message: string) => {
  if (!b) throw new Error(message);
};

export class WeightedMath {
  static _MAX_IN_RATIO = BigInt(300000000000000000);
  static _MAX_OUT_RATIO = BigInt(300000000000000000);
  // Computes how many tokens can be taken out of a pool if `amountIn` are sent, given the
  // current balances and weights.
  static _calcOutGivenIn(
    balanceIn: bigint,
    weightIn: bigint,
    balanceOut: bigint,
    weightOut: bigint,
    amountsIn: bigint[],
  ): bigint[] {
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
