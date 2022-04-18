import { BIs } from '../../constants';

const PRECISION = BIs.POWS[18];

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

  let zInPrecision = k % BIs[2] == BIs[0] ? PRECISION : xInPrecision;

  for (let c = k / BIs[2]; c != BIs[0]; c = c / BIs[2]) {
    xInPrecision = mulInPrecision(xInPrecision, xInPrecision);

    if (c % BIs[2] != BIs[0]) {
      zInPrecision = mulInPrecision(zInPrecision, xInPrecision);
    }
  }
  return zInPrecision;
};
