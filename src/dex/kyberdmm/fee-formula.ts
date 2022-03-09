import BigNumber from 'bignumber.js';
import { mulInPrecision, unsafePowInPrecision } from './math-ext';

export const PRECISION = new BigNumber(10).pow(18);
const R0 = new BigNumber('1477405064814996100'); // 1.4774050648149961

const C0 = new BigNumber(60).times(PRECISION).idiv(10000);

const A = new BigNumber(PRECISION).times(20000).idiv(27);
const B = new BigNumber(PRECISION).times(250).idiv(9);
const C1 = new BigNumber(PRECISION).times(985).idiv(27);
const U = new BigNumber(120).times(PRECISION).idiv(100);

const G = new BigNumber(836).times(PRECISION).idiv(1000);
const F = new BigNumber(5).times(PRECISION);
const L = new BigNumber(2).times(PRECISION).idiv(10000);
// C2 = 25 * PRECISION - (F * (PRECISION - G)**2) / ((PRECISION - G)**2 + L * PRECISION)
const C2 = new BigNumber('20036905816356657810');

/// @dev calculate fee from rFactorInPrecision, see section 3.2 in dmmSwap white paper
/// @dev fee in [15, 60] bps
/// @return fee percentage in Precision
export const getFee = (rFactorInPrecision: BigNumber): BigNumber => {
  if (rFactorInPrecision.gte(R0)) {
    return C0;
  } else if (rFactorInPrecision.gte(PRECISION)) {
    // C1 + A * (r-U)^3 + b * (r -U)
    if (rFactorInPrecision.gt(U)) {
      const tmp = rFactorInPrecision.minus(U);
      const tmp3 = unsafePowInPrecision(tmp, new BigNumber(3));
      return C1.plus(mulInPrecision(A, tmp3))
        .plus(mulInPrecision(B, tmp))
        .idiv(10000);
    } else {
      const tmp = U.minus(rFactorInPrecision);
      const tmp3 = unsafePowInPrecision(tmp, new BigNumber(3));
      return C1.minus(mulInPrecision(A, tmp3))
        .minus(mulInPrecision(B, tmp))
        .idiv(10000);
    }
  } else {
    // [ C2 + sign(r - G) *  F * (r-G) ^2 / (L + (r-G) ^2) ] / 10000
    let tmp = rFactorInPrecision.gt(G)
      ? rFactorInPrecision.minus(G)
      : G.minus(rFactorInPrecision);
    tmp = unsafePowInPrecision(tmp, new BigNumber(2));
    const tmp2 = F.times(tmp).idiv(tmp.plus(L));
    if (rFactorInPrecision.gt(G)) {
      return C2.plus(tmp2).idiv(10000);
    } else {
      return C2.minus(tmp2).idiv(10000);
    }
  }
};

/**
 * TrendVolume calculation
 */

type TrendData = {
  shortEMA: BigNumber;
  longEMA: BigNumber;
  lastBlockVolume: BigNumber;
  lastTradeBlock: BigNumber;
};

const SHORT_ALPHA = new BigNumber(2).times(PRECISION).idiv(5401);
const LONG_ALPHA = new BigNumber(2).times(PRECISION).idiv(10801);

/// @return rFactor in Precision for this trade
export const getRFactor = (
  blockNumber: BigNumber,
  trendData: TrendData,
): BigNumber => {
  const {
    shortEMA,
    longEMA,
    lastBlockVolume: currentBlockVolume,
    lastTradeBlock,
  } = trendData;
  // this can not be underflow because block.number always increases
  const skipBlock = blockNumber.minus(lastTradeBlock);
  if (skipBlock.eq(0)) {
    return calculateRFactor(shortEMA, longEMA);
  }
  let _shortEMA = newEMA(shortEMA, SHORT_ALPHA, currentBlockVolume);
  let _longEMA = newEMA(longEMA, LONG_ALPHA, currentBlockVolume);
  _shortEMA = mulInPrecision(
    _shortEMA,
    unsafePowInPrecision(PRECISION.minus(SHORT_ALPHA), skipBlock.minus(1)),
  );
  _longEMA = mulInPrecision(
    _longEMA,
    unsafePowInPrecision(PRECISION.minus(LONG_ALPHA), skipBlock.minus(1)),
  );
  return calculateRFactor(_shortEMA, _longEMA);
};

export const calculateRFactor = (
  _shortEMA: BigNumber,
  _longEMA: BigNumber,
): BigNumber => {
  if (_longEMA.eq(0)) {
    return new BigNumber(0);
  }
  return _shortEMA.times(PRECISION).idiv(_longEMA);
};

/// @dev return newEMA value
/// @param ema previous ema value in wei
/// @param alpha in Precicion (required < Precision)
/// @param value current value to update ema
/// @dev ema and value is uint128 and alpha < Percison
/// @dev so this function can not overflow and returned ema is not overflow uint128
export const newEMA = (
  ema: BigNumber,
  alpha: BigNumber,
  value: BigNumber,
): BigNumber => {
  if (alpha.gt(PRECISION)) throw new Error('NewEma: alpha > PRECISION');
  return PRECISION.minus(alpha)
    .times(ema)
    .plus(alpha.times(value))
    .idiv(PRECISION);
};
