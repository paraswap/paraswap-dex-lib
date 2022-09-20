import BigNumber from 'bignumber.js';

export const BN_0 = new BigNumber(0);
export const BN_1 = new BigNumber(1);
export const BN_2 = new BigNumber(2);
export const BN_10 = new BigNumber(10);
export const BN_100 = new BigNumber(100);
export const BN_600 = new BigNumber(600);

export const BN_MAX_UINT = BN_2.pow(256).minus(1);
// Indexes represent the number of zeros after 1
export const BN_POWS = new Array(19)
  .fill(undefined)
  .map((_0, index) => new BigNumber(`1${'0'.repeat(index)}`));

export function getBigNumberPow(decimals: number): BigNumber {
  const value = BN_POWS[decimals];
  // It is not accurate to create 10 ** 23 and more decimals from number type
  return value === undefined ? BN_10.pow(decimals) : value;
}
