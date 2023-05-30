import { FullMath } from "./FullMath";

export interface Rebase {
    elastic: bigint;
    base: bigint;
  }

/// @notice A rebasing library
export class  RebaseLibrary {
/// @notice Calculates the base value in relationship to `elastic` and `total`.
    static toBase(total: Rebase, elastic: bigint, roundup: boolean): bigint {

        let base: bigint;
        if (total.elastic === 0n) {
        base = elastic;
        } else {
        base = roundup ? FullMath.mulDivRoundingUp(elastic,total.base,total.elastic) : FullMath.mulDiv(elastic,total.base,total.elastic)
        }
        return base;
    }

    /// @notice Calculates the elastic value in relationship to `base` and `total`.
    static toElastic(total: Rebase, base: bigint, roundup : boolean): bigint {
        let elastic: bigint;
        if (total.base === 0n) {
        elastic = base;
        } else {
        elastic = roundup ? FullMath.mulDivRoundingUp(base,total.elastic,total.base): FullMath.mulDiv(base,total.elastic,total.base)
        }

        return elastic;
    }

}

function mulDivRoundingUp(arg0: bigint) {
    throw new Error("Function not implemented.");
}
  