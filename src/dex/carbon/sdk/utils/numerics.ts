import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import {
  parseUnits as _parseUnits,
  formatUnits as _formatUnits,
} from '@ethersproject/units';
import Decimal from 'decimal.js';

Decimal.set({
  precision: 100,
  rounding: Decimal.ROUND_HALF_DOWN,
  toExpNeg: -30,
  toExpPos: 30,
});

export { Decimal, BigNumber, BigNumberish };

export const BigNumberMin = (a: BigNumber, b: BigNumber) => (a.lt(b) ? a : b);
export const BigNumberMax = (a: BigNumber, b: BigNumber) => (a.gt(b) ? a : b);

export const ONE = 2 ** 48;
export const TEN = new Decimal(10);

export const tenPow = (dec0: number, dec1: number) => {
  const diff = dec0 - dec1;
  return TEN.pow(diff);
};

export const BnToDec = (x: BigNumber) => new Decimal(x.toString());
export const DecToBn = (x: Decimal) => BigNumber.from(x.toFixed());

export const mulDiv = (x: BigNumber, y: BigNumber, z: BigNumber) =>
  y.eq(z) ? x : x.mul(y).div(z);

function trimDecimal(input: string, precision: number): string {
  let decimalIdx = input.indexOf('.');
  if (decimalIdx !== -1) {
    return input.slice(0, decimalIdx + precision + 1);
  }
  return input;
}

// A take on parseUnits that supports floating point
export function parseUnits(amount: string, decimals: number): BigNumber {
  const trimmed = trimDecimal(amount, decimals);
  return _parseUnits(trimmed, decimals);
}

export function formatUnits(amount: BigNumberish, decimals: number): string {
  const res = _formatUnits(amount, decimals);

  // remove trailing 000
  return new Decimal(res).toFixed();
}
