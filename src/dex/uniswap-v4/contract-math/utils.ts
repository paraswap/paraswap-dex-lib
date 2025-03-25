export function _mulmod(x: bigint, y: bigint, m: bigint): bigint {
  return m === 0n ? 0n : (x * y) % m;
}

export function _lt(x: bigint, y: bigint) {
  return x < y ? 1n : 0n;
}

export function _gt(x: bigint, y: bigint) {
  return x > y ? 1n : 0n;
}

export function toBalanceDelta(amount0: bigint, amount1: bigint): bigint {
  const shiftedAmount0 = amount0 << 128n;

  const mask = (1n << 128n) - 1n;

  const maskedAmount1 = amount1 & mask;

  const balanceDelta = shiftedAmount0 | maskedAmount1;

  return balanceDelta;
}
