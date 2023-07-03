export type Tick = {
  liquidityTotal: bigint;
  liquidityDelta: bigint;
  outerFeeGrowth0Token: bigint;
  outerFeeGrowth1Token: bigint;
  outerTickCumulative: bigint;
  outerSecondsPerLiquidity: bigint;
  outerSecondsSpent: bigint;
  initialized: boolean;
};
