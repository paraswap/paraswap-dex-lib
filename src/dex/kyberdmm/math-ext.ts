import BigNumber from 'bignumber.js';

const PRECISION = new BigNumber(10).pow(18);

/// @dev Returns x*y in precision
export const mulInPrecision = (x: BigNumber, y: BigNumber): BigNumber =>
  x.times(y).idiv(PRECISION);

/// @dev source: dsMath
/// @param xInPrecision should be < PRECISION, so this can not overflow
/// @return zInPrecision = (x/PRECISION) ^k * PRECISION
export const unsafePowInPrecision = (
  xInPrecision: BigNumber,
  k: BigNumber,
): BigNumber => {
  if (!xInPrecision.lte(PRECISION)) throw new Error(`MathExt: x > PRECISION`);

  let zInPrecision = k.mod(2).eq(0) ? PRECISION : xInPrecision;

  for (let c = k.idiv(2); !c.eq(0); c = c.idiv(2)) {
    xInPrecision = xInPrecision.times(xInPrecision).idiv(PRECISION);

    if (!c.mod(2).eq(0)) {
      zInPrecision = zInPrecision.times(xInPrecision).idiv(PRECISION);
    }
  }
  return zInPrecision;
};
