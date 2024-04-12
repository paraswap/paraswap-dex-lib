export function _reduceFee(amountIn: bigint, swapFee: bigint): bigint {
  const product = amountIn * swapFee;
  const feeAmount = (product - 1n) / 1000000000000000000n + 1n;
  return amountIn - feeAmount;
}

export function _addFee(amountIn: bigint, swapFee: bigint): bigint {
  const fee = 1000000000000000000n - swapFee;
  return divUp(amountIn, fee);
}

function divUp(a: bigint, b: bigint): bigint {
  const aInflated = a * 1000000000000000000n;
  return (aInflated - 1n) / b + 1n;
}
