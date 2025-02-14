import { MAX_U256 } from './constants';

export function nextSqrtRatioFromAmount0(
  sqrtRatio: bigint,
  liquidity: bigint,
  amount0: bigint,
): bigint | null {
  if (amount0 === 0n) return sqrtRatio;

  if (liquidity === 0n) throw new Error('NO_LIQUIDITY');

  const numerator1 = liquidity << 128n;

  // because quotient is rounded down, this price movement is also rounded towards sqrt_ratio
  if (amount0 < 0n) {
    const product = amount0 * -1n * sqrtRatio;

    if (product >= MAX_U256) {
      return null;
    }

    const denominator = numerator1 - product;

    if (denominator < 0n) {
      return null;
    }

    const num = numerator1 * sqrtRatio;

    const result = num / denominator + (num % denominator === 0n ? 0n : 1n);

    if (result > MAX_U256) {
      return null;
    }

    return result;
  } else {
    const denomP1 = numerator1 / sqrtRatio;

    const denom = denomP1 + amount0;
    const quotient = numerator1 / denom;
    const remainder = numerator1 % denom;

    if (remainder === 0n) return quotient;
    const sum = quotient + 1n;
    if (sum > MAX_U256) return null;
    return sum;
  }
}

export function nextSqrtRatioFromAmount1(
  sqrtRatio: bigint,
  liquidity: bigint,
  amount1: bigint,
): bigint | null {
  if (amount1 === 0n) return sqrtRatio;

  if (liquidity === 0n) throw new Error('NO_LIQUIDITY');

  const amountShifted = amount1 << 128n;
  const quotient = amountShifted / liquidity;
  const remainder = amountShifted % liquidity;

  // because quotient is rounded down, this price movement is also rounded towards sqrt_ratio
  if (amount1 < 0n) {
    // adding amount1, taking out amount0
    const res = sqrtRatio + quotient;
    if (res < 0n) {
      return null;
    }
    if (remainder === 0n) {
      return res;
    } else {
      if (res != 0n) {
        return res - 1n;
      } else {
        return null;
      }
    }
  } else {
    // adding amount1, taking out amount0, price goes up
    const res = sqrtRatio + quotient;
    if (res > MAX_U256) {
      return null;
    } else {
      return res;
    }
  }
}
