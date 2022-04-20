import { BI_POWS } from '../../bigint-constants';
import { mulInPrecision, unsafePowInPrecision } from './math-ext';

export const PRECISION = BI_POWS[18];
const R0 = 1477405064814996100n; // 1.4774050648149961

const C0 = (60n * PRECISION) / BI_POWS[4];

const A = (PRECISION * 20000n) / 27n;
const B = (PRECISION * 250n) / 9n;
const C1 = (PRECISION * 985n) / 27n;
const U = (120n * PRECISION) / 100n;

const G = (836n * PRECISION) / BI_POWS[3];
const F = 5n * PRECISION;
const L = (2n * PRECISION) / BI_POWS[4];
// C2 = 25 * PRECISION - (F * (PRECISION - G)**2) / ((PRECISION - G)**2 + L * PRECISION)
const C2 = 20036905816356657810n;

/// @dev calculate fee from rFactorInPrecision, see section 3.2 in dmmSwap white paper
/// @dev fee in [15, 60] bps
/// @return fee percentage in Precision
export const getFee = (rFactorInPrecision: bigint): bigint => {
  if (rFactorInPrecision >= R0) {
    return C0;
  } else if (rFactorInPrecision >= PRECISION) {
    // C1 + A * (r-U)^3 + b * (r -U)
    if (rFactorInPrecision > U) {
      const tmp = rFactorInPrecision - U;
      const tmp3 = unsafePowInPrecision(tmp, 3n);
      return (
        (C1 + mulInPrecision(A, tmp3) + mulInPrecision(B, tmp)) / BI_POWS[4]
      );
    } else {
      const tmp = U - rFactorInPrecision;
      const tmp3 = unsafePowInPrecision(tmp, 3n);
      return (
        (C1 - mulInPrecision(A, tmp3) - mulInPrecision(B, tmp)) / BI_POWS[4]
      );
    }
  } else {
    // [ C2 + sign(r - G) *  F * (r-G) ^2 / (L + (r-G) ^2) ] / 10000
    let tmp =
      rFactorInPrecision > G ? rFactorInPrecision - G : G - rFactorInPrecision;
    tmp = unsafePowInPrecision(tmp, 2n);
    const tmp2 = (F * tmp) / (tmp + L);
    if (rFactorInPrecision > G) {
      return (C2 + tmp2) / BI_POWS[4];
    } else {
      return (C2 - tmp2) / BI_POWS[4];
    }
  }
};

/**
 * TrendVolume calculation
 */

type TrendData = {
  shortEMA: bigint;
  longEMA: bigint;
  lastBlockVolume: bigint;
  lastTradeBlock: bigint;
};

const SHORT_ALPHA = (2n * PRECISION) / 5401n;
const LONG_ALPHA = (2n * PRECISION) / 10801n;

/// @return rFactor in Precision for this trade
export const getRFactor = (
  blockNumber: bigint,
  trendData: TrendData,
): bigint => {
  const {
    shortEMA,
    longEMA,
    lastBlockVolume: currentBlockVolume,
    lastTradeBlock,
  } = trendData;
  // this can not be underflow because block.number always increases
  const skipBlock = blockNumber - lastTradeBlock;
  if (skipBlock == 0n) {
    return calculateRFactor(shortEMA, longEMA);
  }
  let _shortEMA = newEMA(shortEMA, SHORT_ALPHA, currentBlockVolume);
  let _longEMA = newEMA(longEMA, LONG_ALPHA, currentBlockVolume);
  _shortEMA = mulInPrecision(
    _shortEMA,
    unsafePowInPrecision(PRECISION - SHORT_ALPHA, skipBlock - 1n),
  );
  _longEMA = mulInPrecision(
    _longEMA,
    unsafePowInPrecision(PRECISION - LONG_ALPHA, skipBlock - 1n),
  );
  return calculateRFactor(_shortEMA, _longEMA);
};

export const calculateRFactor = (
  _shortEMA: bigint,
  _longEMA: bigint,
): bigint => {
  if (_longEMA == 0n) {
    return 0n;
  }
  return (_shortEMA * PRECISION) / _longEMA;
};

/// @dev return newEMA value
/// @param ema previous ema value in wei
/// @param alpha in Precision (required < Precision)
/// @param value current value to update ema
/// @dev ema and value is uint128 and alpha < Precision
/// @dev so this function can not overflow and returned ema is not overflow uint128
export const newEMA = (ema: bigint, alpha: bigint, value: bigint): bigint => {
  if (alpha > PRECISION) throw new Error('NewEma: alpha > PRECISION');
  return ((PRECISION - alpha) * ema + alpha * value) / PRECISION;
};
