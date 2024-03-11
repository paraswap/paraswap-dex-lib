import { parseUnits } from 'ethers/lib/utils';

import { CurrencyAmount, Trade } from './types';

// Constants to compute approximate equality
const APPROX_EQ_PRECISION = 1n;
const APPROX_EQ_BASE_PRECISION = 1000000n;

/**
 * Computes logarithm in base 2 for a given positive number.
 * Result is rounded down.
 *
 * @param {bigint} value - value to compute the log2
 * @returns {bigint} the log in base 2 of the value, 0 if given 0.
 */
/* eslint-disable no-param-reassign */
export function log2(value: bigint): bigint {
  let result = 0n;

  if (value >> 128n > 0n) {
    value >>= 128n;
    result += 128n;
  }

  if (value >> 64n > 0n) {
    value >>= 64n;
    result += 64n;
  }

  if (value >> 32n > 0n) {
    value >>= 32n;
    result += 32n;
  }

  if (value >> 16n > 0n) {
    value >>= 16n;
    result += 16n;
  }

  if (value >> 8n > 0n) {
    value >>= 8n;
    result += 8n;
  }

  if (value >> 4n > 0n) {
    value >>= 4n;
    result += 4n;
  }

  if (value >> 2n > 0n) {
    value >>= 2n;
    result += 2n;
  }

  if (value >> 1n > 0n) {
    result += 1n;
  }

  return result;
}

/**
 * Computes the square root of a number. If the number is not a perfect square, the value is rounded down.
 * Inspired by Henry S. Warren, Jr.'s "Hacker's Delight" (Chapter 11).
 *
 * @param {bigint} value - value to compute the square root
 * @returns {bigint} the square root of the value
 */
export function sqrt(value: bigint): bigint {
  if (value === 0n) {
    return 0n;
  }

  // For our first guess, we get the biggest power of 2 which is smaller than the square root of the target.
  //
  // We know that the "msb" (most significant bit) of our target number `a` is a power of 2 such that we have
  // `msb(a) <= a < 2*msb(a)`. This value can be written `msb(a)=2**k` with `k=log2(a)`.
  //
  // This can be rewritten `2**log2(a) <= a < 2**(log2(a) + 1)`
  // → `sqrt(2**k) <= sqrt(a) < sqrt(2**(k+1))`
  // → `2**(k/2) <= sqrt(a) < 2**((k+1)/2) <= 2**(k/2 + 1)`
  //
  // Consequently, `2**(log2(a) / 2)` is a good first approximation of `sqrt(a)` with at least 1 correct bit.
  let result = 1n << (log2(value) / 2n);

  // At this point `result` is an estimation with one bit of precision. We know the true value is a uint128,
  // since it is the square root of a uint256. Newton's method converges quadratically (precision doubles at
  // every iteration). We thus need at most 7 iteration to turn our partial result with one bit of precision
  // into the expected uint128 result.
  result = (result + value / result) >> 1n;
  result = (result + value / result) >> 1n;
  result = (result + value / result) >> 1n;
  result = (result + value / result) >> 1n;
  result = (result + value / result) >> 1n;
  result = (result + value / result) >> 1n;
  result = (result + value / result) >> 1n;

  return result < value / result ? result : value / result;
}

/**
 * Evaluates the equality of two numbers at a precision of 1/1_000_000
 *
 * @param {bigint} x - value to compare
 * @param {bigint} y - value to compare
 * @returns {boolean} true if numbers are approximatively equal at 1/1_000_000, false otherwise
 */
export function approxEq(x: bigint, y: bigint): true | false {
  return x > y
    ? x < y + (y * APPROX_EQ_PRECISION) / APPROX_EQ_BASE_PRECISION
    : y < x + (x * APPROX_EQ_PRECISION) / APPROX_EQ_BASE_PRECISION;
}

/**
 * Evaluates the equality of two ratio numbers at a precision of 1/1_000_000. xNum / xDen ~= yNum / yDen
 *
 * @param {bigint} _xNum - first number numerator
 * @param {bigint} _xDen - first number denominator
 * @param {bigint} _yNum - second number numerator
 * @param {bigint} _yDen - second number denominator
 * @returns {boolean} true if the two ratios are approximatively equal at 1/1_000_000, false otherwise
 */
export function ratioApproxEq(
  _xNum: bigint,
  _xDen: bigint,
  _yNum: bigint,
  _yDen: bigint,
): true | false {
  return approxEq(_xNum * _yDen, _xDen * _yNum);
}

/**
 * Computes the ratio of two numbers
 *
 * @param {bigint} numerator - numerator number
 * @param {bigint} denominator - denominator number
 * @param {number} decimals - decimals
 * @returns {bigint} ratio of the two numbers. returns 0 if denominator is 0
 */
export function priceRatio(
  numerator: bigint,
  denominator: bigint,
  decimals = 18,
) {
  if (denominator === 0n) {
    return 0n;
  }

  return (
    BigInt(parseUnits(numerator.toString(), decimals).toString()) / denominator
  );
}

export function abs(value: bigint) {
  return value === -0n || value < 0n ? -value : value;
}
