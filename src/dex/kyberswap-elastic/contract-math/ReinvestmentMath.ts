import { FullMath } from './FullMath';
export class ReinvestmentMath {
  static calcrMintQty(
    reinvestL: bigint,
    reinvestLLast: bigint,
    baseL: bigint,
    rTokenSupply: bigint,
  ): bigint {
    let rMintQty: bigint = 0n;

    let lpContribution = FullMath.mulDivFloor(
      baseL,
      reinvestL - reinvestLLast,
      baseL + reinvestL,
    );
    rMintQty = FullMath.mulDivFloor(
      rTokenSupply,
      lpContribution,
      reinvestLLast,
    );
    return rMintQty;
  }
}
