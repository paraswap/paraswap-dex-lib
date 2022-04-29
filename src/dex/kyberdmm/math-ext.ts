import { BI_POWS } from '../../bigint-constants';

const PRECISION = BI_POWS[18];

/// @dev Returns x*y in precision
export const mulInPrecision = (x: bigint, y: bigint): bigint => {
  return (x * y) / PRECISION;
};

/// @dev source: dsMath
/// @param xInPrecision should be < PRECISION, so this can not overflow
/// @return zInPrecision = (x/PRECISION) ^k * PRECISION
export const unsafePowInPrecision = (
  xInPrecision: bigint,
  k: bigint,
): bigint => {
  if (xInPrecision > PRECISION) throw new Error(`MathExt: x > PRECISION`);

  let zInPrecision = k % 2n == 0n ? PRECISION : xInPrecision;

  for (let c = k / 2n; c != 0n; c = c / 2n) {
    xInPrecision = mulInPrecision(xInPrecision, xInPrecision);

    if (c % 2n != 0n) {
      zInPrecision = mulInPrecision(zInPrecision, xInPrecision);
    }
  }
  return zInPrecision;
};
