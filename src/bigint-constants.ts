import { MAX_INT } from './constants';

// Indexes represent the number of zeros after 1
// We use as much as 36 zeros
export const BI_POWS = new Array(37)
  .fill(undefined)
  .map((_0, index) => BigInt(`1${'0'.repeat(index)}`));

export const BI_MAX_INT = BigInt(MAX_INT);
export const BI_MAX_UINT = 2n ** 256n - 1n;
