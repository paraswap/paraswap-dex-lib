export function _require(
  b: boolean,
  message: string,
  values?: Record<string, bigint | number>,
  condition?: string,
): void {
  let receivedValues = '';
  if (values && condition) {
    const keyValueStr = Object.entries(values)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
    receivedValues = `Values: ${keyValueStr}. Condition: ${condition} violated`;
  }
  if (!b) throw new Error(`${receivedValues}${message}`);
}

export function _mulmod(x: bigint, y: bigint, m: bigint): bigint {
  return m === 0n ? 0n : (x * y) % m;
}

export function _lt(x: bigint, y: bigint) {
  return x < y ? 1n : 0n;
}

export function _gt(x: bigint, y: bigint) {
  return x > y ? 1n : 0n;
}
