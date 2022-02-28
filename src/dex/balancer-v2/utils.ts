export function getTokenScalingFactor(tokenDecimals: number): bigint {
  return BigInt(1e18) * BigInt(10) ** BigInt(18 - tokenDecimals);
}
