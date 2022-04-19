import { MathSol } from './balancer-v2-math';
export class BasePool {
  _subtractSwapFeeAmount(amount: bigint, _swapFeePercentage: bigint): bigint {
    // This returns amount - fee amount, so we round up (favoring a higher fee amount).
    const feeAmount = MathSol.mulUpFixed(amount, _swapFeePercentage);
    return amount - feeAmount;
  }

  // These methods use fixed versions to match SC scaling
  _upscaleArray(amounts: bigint[], scalingFactors: bigint[]): bigint[] {
    return amounts.map((a, i) => MathSol.mulUpFixed(a, scalingFactors[i]));
  }

  _upscale(amount: bigint, scalingFactor: bigint): bigint {
    return MathSol.mulUpFixed(amount, scalingFactor);
  }

  _downscaleDown(amount: bigint, scalingFactor: bigint): bigint {
    return MathSol.divDownFixed(amount, scalingFactor);
  }
}
