import { BI_0, BI_2, BI_POWS } from '../../bigint-constants';

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

  let zInPrecision = k % BI_2 == BI_0 ? PRECISION : xInPrecision;

  for (let c = k / BI_2; c != BI_0; c = c / BI_2) {
    xInPrecision = mulInPrecision(xInPrecision, xInPrecision);

    if (c % BI_2 != BI_0) {
      zInPrecision = mulInPrecision(zInPrecision, xInPrecision);
    }
  }
  return zInPrecision;
};
