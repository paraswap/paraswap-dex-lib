export class LiqDeltaMath {
  static applyLiquidityDelta(
    liquidity: bigint,
    liquidityDelta: bigint,
    isAddLiquidity: boolean,
  ): bigint {
    return isAddLiquidity
      ? liquidity + liquidityDelta
      : liquidity - liquidityDelta;
  }
}
