import {
  BI_0,
  BI_1,
  BI_100,
  BI_2,
  BI_3,
  BI_5,
  BI_9,
  BI_POW_18,
  BI_POW_3,
  BI_POW_4,
} from '../../bigint-constants';
import { mulInPrecision, unsafePowInPrecision } from './math-ext';

export const PRECISION = BI_POW_18;
const R0 = BigInt('1477405064814996100'); // 1.4774050648149961

const C0 = (BigInt(60) * PRECISION) / BI_POW_4;

const A = (PRECISION * BigInt(20000)) / BigInt(27);
const B = (PRECISION * BigInt(250)) / BI_9;
const C1 = (PRECISION * BigInt(985)) / BigInt(27);
const U = (BigInt(120) * PRECISION) / BI_100;

const G = (BigInt(836) * PRECISION) / BI_POW_3;
const F = BI_5 * PRECISION;
const L = (BI_2 * PRECISION) / BI_POW_4;
// C2 = 25 * PRECISION - (F * (PRECISION - G)**2) / ((PRECISION - G)**2 + L * PRECISION)
const C2 = BigInt('20036905816356657810');

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
      const tmp3 = unsafePowInPrecision(tmp, BI_3);
      return (C1 + mulInPrecision(A, tmp3) + mulInPrecision(B, tmp)) / BI_POW_4;
    } else {
      const tmp = U - rFactorInPrecision;
      const tmp3 = unsafePowInPrecision(tmp, BI_3);
      return (C1 - mulInPrecision(A, tmp3) - mulInPrecision(B, tmp)) / BI_POW_4;
    }
  } else {
    // [ C2 + sign(r - G) *  F * (r-G) ^2 / (L + (r-G) ^2) ] / 10000
    let tmp =
      rFactorInPrecision > G ? rFactorInPrecision - G : G - rFactorInPrecision;
    tmp = unsafePowInPrecision(tmp, BI_2);
    const tmp2 = (F * tmp) / (tmp + L);
    if (rFactorInPrecision > G) {
      return (C2 + tmp2) / BI_POW_4;
    } else {
      return (C2 - tmp2) / BI_POW_4;
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

const SHORT_ALPHA = (BI_2 * PRECISION) / BigInt(5401);
const LONG_ALPHA = (BI_2 * PRECISION) / BigInt(10801);

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
  if (skipBlock == BI_0) {
    return calculateRFactor(shortEMA, longEMA);
  }
  let _shortEMA = newEMA(shortEMA, SHORT_ALPHA, currentBlockVolume);
  let _longEMA = newEMA(longEMA, LONG_ALPHA, currentBlockVolume);
  _shortEMA = mulInPrecision(
    _shortEMA,
    unsafePowInPrecision(PRECISION - SHORT_ALPHA, skipBlock - BI_1),
  );
  _longEMA = mulInPrecision(
    _longEMA,
    unsafePowInPrecision(PRECISION - LONG_ALPHA, skipBlock - BI_1),
  );
  return calculateRFactor(_shortEMA, _longEMA);
};

export const calculateRFactor = (
  _shortEMA: bigint,
  _longEMA: bigint,
): bigint => {
  if (_longEMA == BI_0) {
    return BI_0;
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
