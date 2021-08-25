import { ETHER_ADDRESS } from './constants';

export const isETHAddress = (address: string) =>
  address.toLowerCase() === ETHER_ADDRESS.toLowerCase();

export const prependWithOx = (str: string) =>
  str.startsWith('0x') ? str : '0x' + str;

// This function guarantees that the distribution adds up to exactly 100% by
// applying rounding in the other direction for numbers with the most error.
export function convertToBasisPoints(dist: number[]): number[] {
  const BPS = 10000;
  const sumDist = dist.reduce((a, b) => a + b, 0);
  const basisPoints = dist.map(n => (n * BPS) / sumDist);
  const rounded = basisPoints.map(n => Math.round(n));
  const sumRounded = rounded.reduce((a, b) => a + b, 0);
  if (sumRounded === BPS) {
    return rounded;
  }
  const errors = basisPoints.map((n, i) => ({
    error: rounded[i] - n,
    index: i,
  }));
  if (sumRounded < BPS) {
    errors.sort((a, b) => a.error - b.error);
    for (let i = 0; i < BPS - sumRounded; ++i) {
      ++rounded[errors[i].index];
    }
  } else {
    errors.sort((a, b) => b.error - a.error);
    for (let i = 0; i < sumRounded - BPS; ++i) {
      --rounded[errors[i].index];
    }
  }
  return rounded;
}
