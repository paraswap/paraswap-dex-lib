// Protocol's fees constants
export const FEES_LP = BigInt(500);
export const FEES_POOL = BigInt(200);
export const FEES_TOTAL = FEES_LP + FEES_POOL;
export const FEES_BASE = BigInt(1000);
export const FEES_TOTAL_REVERSED = FEES_BASE - FEES_TOTAL;
export interface Pair {
  address?: string;
  token0: string;
  token1: string;
  reserve0: bigint;
  reserve1: bigint;
  reserve0LastFictive: bigint;
  reserve1LastFictive: bigint;
  priceAverageLastTimestamp: number;
  priceAverage0: bigint;
  priceAverage1: bigint;
  forcedPriceAverageTimestamp?: number;
  prevReserveFic0?: bigint;
  prevReserveFic1?: bigint;
}

export interface CurrencyAmount {
  currency: string;
  amount: bigint;
  amountMax?: bigint;
  newRes0?: bigint;
  newRes1?: bigint;
  newRes0Fic?: bigint;
  newRes1Fic?: bigint;
  newPriceAverage0?: bigint;
  newPriceAverage1?: bigint;
  forcedPriceAverageTimestamp?: number;
}

export interface BestTradeOptions {
  maxNumResults?: number; // how many results to return
  maxHops?: number; // the maximum number of hops for the swap
  arbitrage?: boolean; // consider arbitrage loops or not
}

export interface Route {
  pairs: Pair[];
  path: string[];
  input: string;
  output: string;
}

export interface Trade {
  route: Route;
  amountIn: CurrencyAmount;
  amountOut: CurrencyAmount;
  tradeType: TradeType;
  priceImpact?: bigint; // defined only after calling bestTradeExactIn or bestTradeExactOut
}
// constant for function 'updatePriceAverage'
export const MAX_BLOCK_DIFF_SECONDS = process.env.SDK_MAX_BLOCK_DIFF_SECONDS
  ? Number(process.env.SDK_MAX_BLOCK_DIFF_SECONDS)
  : 300;
export const LATENCY_OFFSET_SECONDS = 20;

export enum TradeType {
  EXACT_INPUT,
  EXACT_OUTPUT,
}

import { ratioApproxEq, sqrt } from './utils';

// compute first trade amountIn using arbitrage feature
function computeFirstTradeQtyIn(
  amountIn: bigint,
  reserveInFic: bigint,
  reserveOutFic: bigint,
  priceAverageIn: bigint,
  priceAverageOut: bigint,
  feesLP: bigint,
  feesPool: bigint,
): bigint {
  // default value
  let firstAmountIn = amountIn;

  // if trade is in the good direction
  if (reserveOutFic * priceAverageIn > reserveInFic * priceAverageOut) {
    // pre-compute all operands
    const feesTotalReversed = FEES_BASE - feesLP - feesPool;
    const toSub = reserveInFic * (FEES_BASE + feesTotalReversed - feesPool);
    const toDiv = (feesTotalReversed + feesLP) * 2n;
    const inSqrt =
      ((reserveInFic * reserveOutFic * 4n) / priceAverageOut) *
        priceAverageIn *
        feesTotalReversed *
        (FEES_BASE - feesPool) +
      reserveInFic * reserveInFic * feesLP * feesLP;

    // reverse sqrt check to only compute sqrt if really needed
    if (inSqrt < (amountIn * toDiv + toSub) ** 2n) {
      firstAmountIn = (sqrt(inSqrt) - toSub) / toDiv;
    }
  }

  return firstAmountIn;
}

// compute first trade amountOut using arbitrage feature
function computeFirstTradeQtyOut(
  amountOut: bigint,
  reserveInFic: bigint,
  reserveOutFic: bigint,
  priceAverageIn: bigint,
  priceAverageOut: bigint,
  feesLP: bigint,
  feesPool: bigint,
): bigint {
  // default value
  let firstAmountOut = amountOut;

  // if trade is in the good direction
  if (reserveOutFic * priceAverageIn > reserveInFic * priceAverageOut) {
    // pre-compute all operands
    const feesTotalReversed = FEES_BASE - feesLP - feesPool;
    const reserveOutFicPredictedFees =
      (reserveInFic * feesLP * priceAverageOut) / priceAverageIn;
    const toAdd =
      reserveOutFic * feesTotalReversed * 2n + reserveOutFicPredictedFees;
    const toDiv = feesTotalReversed * 2n;
    const inSqrt =
      (reserveOutFic *
        reserveOutFicPredictedFees *
        4n *
        feesTotalReversed *
        (FEES_BASE - feesPool)) /
        feesLP +
      reserveOutFicPredictedFees ** 2n;

    // reverse sqrt check to only compute sqrt if really needed
    if (inSqrt > (toAdd - amountOut * toDiv) ** 2n) {
      firstAmountOut = (toAdd - sqrt(inSqrt)) / toDiv;
    }
  }

  return firstAmountOut;
}

// apply uniswap k const rule. amountIn -> amountOut
// return [amountOut, newResIn, newResOut, newResInFic, newResOutFic]
function applyKConstRuleOut(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  reserveInFic: bigint,
  reserveOutFic: bigint,
  feesLP: bigint,
  feesPool: bigint,
): [bigint, bigint, bigint, bigint, bigint] {
  // k const rule
  const feesTotalReversed = FEES_BASE - feesLP - feesPool;
  const amountInWithFee = amountIn * feesTotalReversed;
  const numerator = amountInWithFee * reserveOutFic;
  const denominator = reserveInFic * FEES_BASE + amountInWithFee;

  if (denominator === 0n) {
    throw new Error('SMARDEX_K_ERROR');
  }

  const amountOut = numerator / denominator;

  // update new reserves and add lp-fees to pools
  const amountInWithFeeLp = (amountIn * feesLP + amountInWithFee) / FEES_BASE;
  const newResIn = reserveIn + amountInWithFeeLp;
  const newResInFic = reserveInFic + amountInWithFeeLp;
  const newResOut = reserveOut - amountOut;
  const newResOutFic = reserveOutFic - amountOut;

  return [amountOut, newResIn, newResOut, newResInFic, newResOutFic];
}

// apply uniswap k const rule.  amountOut -> amountIn
// returns [amountIn, newResIn, newResOut, newResInFic, newResOutFic]
function applyKConstRuleIn(
  amountOut: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  reserveInFic: bigint,
  reserveOutFic: bigint,
  feesLP: bigint,
  feesPool: bigint,
): [bigint, bigint, bigint, bigint, bigint] {
  // k const rule
  const feesTotalReversed = FEES_BASE - feesLP - feesPool;
  const numerator = reserveInFic * amountOut * FEES_BASE;
  const denominator = (reserveOutFic - amountOut) * feesTotalReversed;

  if (denominator === 0n) {
    throw new Error('SMARDEX_K_ERROR');
  }

  const amountIn = numerator / denominator + 1n;

  // update new reserves
  const amountInWithFeeLp =
    ((feesTotalReversed + feesLP) * amountIn) / FEES_BASE;
  const newResIn = reserveIn + amountInWithFeeLp;
  const newResInFic = reserveInFic + amountInWithFeeLp;
  const newResOut = reserveOut - amountOut;
  const newResOutFic = reserveOutFic - amountOut;

  return [amountIn, newResIn, newResOut, newResInFic, newResOutFic];
}

/**
 * Compute fictive reserves based on current reserves state
 *
 * @param {bigint} reserveIn the reserves of input token.
 * @param {bigint} reserveOut the reserves of output token.
 * @param {bigint} reserveInFic the fictive reserves of input token.
 * @param {bigint} reserveOutFic the fictive reserves of output token.
 * @returns {Array} [ficIn, ficOut]
 */
export function computeReserveFic(
  reserveIn: bigint,
  reserveOut: bigint,
  reserveInFic: bigint,
  reserveOutFic: bigint,
): [bigint, bigint] {
  if (reserveOut * reserveInFic < reserveIn * reserveOutFic) {
    const temp =
      (((reserveOut * reserveOut) / reserveOutFic) * reserveInFic) / reserveIn;
    const newResFicIn =
      (temp * reserveInFic) / reserveOutFic +
      (reserveOut * reserveInFic) / reserveOutFic;
    const newResFicOut = reserveOut + temp;

    return [newResFicIn / 4n, newResFicOut / 4n];
  }

  const newResFicIn = (reserveInFic * reserveOut) / reserveOutFic + reserveIn;
  const newResFicOut = (reserveIn * reserveOutFic) / reserveInFic + reserveOut;

  return [newResFicIn / 4n, newResFicOut / 4n];
}

/**
 * Simulate a full trasaction, if you know the "in" token quantity, provide you the "out" and all reserves change
 * Use case: you want to receive exactly amountOut and want to know the exact amountIn to send.
 * @param {bigint} amountIn the desired input amount of the trade.
 * @param {bigint} reserveIn the reserves of input token.
 * @param {bigint} reserveOut the reserves of output token.
 * @param {bigint} reserveInFic the fictive reserves of input token.
 * @param {bigint} reserveOutFic the fictive reserves of output token.
 * @param {bigint} priceAverageIn the price average of input token.
 * @param {bigint} priceAverageOut the price average of output token.
 * @param {bigint} feesLP LP fees
 * @param {bigint} feesPool Pool fees
 * @returns {Array} [amountOut, newResIn, newResOut, newResInFic, newResOutFic]
 */
export function getAmountOut(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  reserveInFic: bigint,
  reserveOutFic: bigint,
  priceAverageIn: bigint,
  priceAverageOut: bigint,
  feesLP: bigint,
  feesPool: bigint,
): [bigint, bigint, bigint, bigint, bigint] {
  // if (amountIn <= 0n) {
  //   throw new Error('INSUFFICIENT_INPUT_AMOUNT');
  // }

  if (reserveIn <= 0n || reserveOut <= 0n) {
    throw new Error('INSUFFICIENT_LIQUIDITY');
  }

  if (reserveInFic <= 0n || reserveOutFic <= 0n) {
    throw new Error('INSUFFICIENT_LIQUIDITY');
  }

  if (priceAverageIn <= 0n || priceAverageOut <= 0n) {
    throw new Error('INSUFFICIENT_PRICE_AVERAGE');
  }

  let reserveInFicUpdated = reserveInFic;
  let reserveOutFicUpdated = reserveOutFic;

  const feesTotalReversed = FEES_BASE - feesLP - feesPool;
  const amountWithFees = (amountIn * feesTotalReversed) / FEES_BASE;
  const firstAmount = computeFirstTradeQtyIn(
    amountWithFees,
    reserveInFic,
    reserveOutFic,
    priceAverageIn,
    priceAverageOut,
    feesLP,
    feesPool,
  );

  // if there are 2 trades: 1st trade mustn't re-compute ReserveFic, 2nd should
  if (
    firstAmount === amountWithFees &&
    ratioApproxEq(reserveInFic, reserveOutFic, priceAverageIn, priceAverageOut)
  ) {
    [reserveInFicUpdated, reserveOutFicUpdated] = computeReserveFic(
      reserveIn,
      reserveOut,
      reserveInFic,
      reserveOutFic,
    );
  }

  // avoid K constant division by 0
  if (reserveInFicUpdated <= 0n) {
    return [
      0n,
      reserveIn,
      reserveOut,
      reserveInFicUpdated,
      reserveOutFicUpdated,
    ];
  }

  const firstAmountNoFees = (firstAmount * FEES_BASE) / feesTotalReversed;

  let [amountOut, newResIn, newResOut, newResInFic, newResOutFic] =
    applyKConstRuleOut(
      firstAmountNoFees,
      reserveIn,
      reserveOut,
      reserveInFicUpdated,
      reserveOutFicUpdated,
      feesLP,
      feesPool,
    );

  // if we need a second trade
  if (firstAmount < amountWithFees && firstAmountNoFees < amountIn) {
    [newResInFic, newResOutFic] = computeReserveFic(
      newResIn,
      newResOut,
      newResInFic,
      newResOutFic,
    );

    // Avoid K constant division by 0
    if (newResInFic <= 0n) {
      return [
        0n,
        reserveIn,
        reserveOut,
        reserveInFicUpdated,
        reserveOutFicUpdated,
      ];
    }

    let secondAmountOutNoFees: bigint;

    [secondAmountOutNoFees, newResIn, newResOut, newResInFic, newResOutFic] =
      applyKConstRuleOut(
        amountIn - firstAmountNoFees,
        newResIn,
        newResOut,
        newResInFic,
        newResOutFic,
        feesLP,
        feesPool,
      );

    amountOut += secondAmountOutNoFees;
  }

  if (
    newResIn <= 0n ||
    newResOut <= 0n ||
    newResInFic <= 0n ||
    newResOutFic <= 0n
  ) {
    throw new Error('INSUFFICIENT_LIQUIDITY');
  }

  return [amountOut, newResIn, newResOut, newResInFic, newResOutFic];
}

/**
 * Simulate a full transaction, if you know the "out" token quantity, provide you the "in" and all reserves change
 * Use case: you want to receive exactly amountOut and want to know the exact amountIn to send.
 * @param {bigint} amountOut the desired output amount of the trade.
 * @param {bigint} reserveIn the reserves of input token.
 * @param {bigint} reserveOut the reserves of output token.
 * @param {bigint} reserveInFic the fictive reserves of input token.
 * @param {bigint} reserveOutFic the fictive reserves of output token.
 * @param {bigint} priceAverageIn the price average of input token.
 * @param {bigint} priceAverageOut the price average of output token.
 * @param {bigint} feesLP LP fees
 * @param {bigint} feesPool Pool fees
 * @returns {Array} [amountIn, newResIn, newResOut, newResInFic, newResOutFic]
 */
export function getAmountIn(
  amountOut: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  reserveInFic: bigint,
  reserveOutFic: bigint,
  priceAverageIn: bigint,
  priceAverageOut: bigint,
  feesLP: bigint,
  feesPool: bigint,
): [bigint, bigint, bigint, bigint, bigint] {
  if (amountOut <= 0n) {
    throw new Error('INSUFFICIENT_OUTPUT_AMOUNT');
  }

  if (reserveIn <= 0n || reserveOut <= 0n) {
    throw new Error('INSUFFICIENT_LIQUIDITY');
  }

  if (reserveInFic <= 0n || reserveOutFic <= 0n) {
    throw new Error('INSUFFICIENT_LIQUIDITY');
  }

  if (priceAverageIn <= 0n || priceAverageOut <= 0n) {
    throw new Error('INSUFFICIENT_PRICE_AVERAGE');
  }

  let reserveInFicUpdated = reserveInFic;
  let reserveOutFicUpdated = reserveOutFic;

  const firstAmount = computeFirstTradeQtyOut(
    amountOut,
    reserveInFic,
    reserveOutFic,
    priceAverageIn,
    priceAverageOut,
    feesLP,
    feesPool,
  );

  // if there are 2 trades: 1st trade mustn't re-compute ReserveFic, 2nd should
  if (
    firstAmount === amountOut &&
    ratioApproxEq(reserveInFic, reserveOutFic, priceAverageIn, priceAverageOut)
  ) {
    [reserveInFicUpdated, reserveOutFicUpdated] = computeReserveFic(
      reserveIn,
      reserveOut,
      reserveInFic,
      reserveOutFic,
    );
  }

  // Avoid K constant division by 0
  if (reserveInFic <= 0n) {
    return [
      BigInt(0),
      reserveIn,
      reserveOut,
      reserveInFicUpdated,
      reserveOutFicUpdated,
    ];
  }

  let [amountIn, newResIn, newResOut, newResInFic, newResOutFic] =
    applyKConstRuleIn(
      firstAmount,
      reserveIn,
      reserveOut,
      reserveInFicUpdated,
      reserveOutFicUpdated,
      feesLP,
      feesPool,
    );

  // if we need a second trade
  if (firstAmount < amountOut) {
    // in the second trade ALWAYS recompute fictive reserves
    [newResInFic, newResOutFic] = computeReserveFic(
      newResIn,
      newResOut,
      newResInFic,
      newResOutFic,
    );

    // Avoid K constant division by 0
    if (newResInFic <= 0n) {
      return [
        BigInt(0),
        reserveIn,
        reserveOut,
        reserveInFicUpdated,
        reserveOutFicUpdated,
      ];
    }

    let secondAmountIn: bigint;

    [secondAmountIn, newResIn, newResOut, newResInFic, newResOutFic] =
      applyKConstRuleIn(
        amountOut - firstAmount,
        newResIn,
        newResOut,
        newResInFic,
        newResOutFic,
        feesLP,
        feesPool,
      );

    amountIn += secondAmountIn;
  }

  if (
    newResIn <= 0n ||
    newResOut <= 0n ||
    newResInFic <= 0n ||
    newResOutFic <= 0n
  ) {
    throw new Error('INSUFFICIENT_LIQUIDITY');
  }

  return [amountIn, newResIn, newResOut, newResInFic, newResOutFic];
}

/**
 * Computes the priceAverageIn and priceAverageOut.
 * Use case: you want to send an exact amount of tokenIn and know exactly how much you it will give you of tokenOut.
 * Price averages are modified only if current timestamp does not match last timestamp
 * @param {bigint} reserveFicIn the fictuve reserves of input token.
 * @param {bigint} reserveFicOut the fictuve reserves of output token.
 * @param {number} priceAverageLastTimestamp last timestamp in seconds of price average values.
 * @param {bigint} priceAverageIn the latest price average of input token.
 * @param {bigint} priceAverageOut the latest price average of output token.
 * @param {number} currentTimestampInSecond current timestamp in seconds.
 * @param {number} maxBlockDiffSeconds: Max block difference in seconds
 * @returns {Array} [priceAverageIn, priceAverageOut]
 */
export function getUpdatedPriceAverage(
  reserveFicIn: bigint,
  reserveFicOut: bigint,
  priceAverageLastTimestamp: number,
  priceAverageIn: bigint,
  priceAverageOut: bigint,
  currentTimestampInSecond: number,
  maxBlockDiffSeconds: number,
): [bigint, bigint] {
  if (currentTimestampInSecond < priceAverageLastTimestamp) {
    throw new Error('INVALID_TIMESTAMP');
  }

  // very first time
  if (
    priceAverageLastTimestamp === 0 ||
    priceAverageIn === 0n ||
    priceAverageOut === 0n
  ) {
    return [reserveFicIn, reserveFicOut];
  }

  // another tx has been done in the same block
  if (priceAverageLastTimestamp === currentTimestampInSecond) {
    return [priceAverageIn, priceAverageOut];
  }

  // need to compute new linear-average price
  // compute new price:
  const timeDiff = Math.min(
    currentTimestampInSecond - priceAverageLastTimestamp,
    maxBlockDiffSeconds,
  );

  const priceAverageInRet = reserveFicIn;
  const priceAverageOutRet =
    ((priceAverageOut *
      priceAverageInRet *
      BigInt(maxBlockDiffSeconds - timeDiff)) /
      priceAverageIn +
      reserveFicOut * BigInt(timeDiff)) /
    BigInt(maxBlockDiffSeconds);

  return [priceAverageInRet, priceAverageOutRet];
}

/**
 * Computes the amount of tokenOut, at the precision of 1 wei.
 * Use case: you want to send an exact amount of tokenIn and know exactly how much you it will give you of tokenOut.
 * WARNING: token0 and token1 are pair tokens which addresses hexadecimal's values are sorted as token0 < token1.
 * @param {string} token0 the currency address of token0.
 * @param {string} token1 the currency address of token1.
 * @param {bigint} reserve0 the reserves of token0.
 * @param {bigint} reserve1 the reserves of token1.
 * @param {bigint} reserve0Fic the fictionnal reserves of token0.
 * @param {bigint} reserve1Fic the fictionnal reserves of token1.
 * @param {bigint} tokenAmountIn the input amount of the trade.
 * @param {bigint} tokenAddressIn address of the input token.
 * @param {number} priceAverageLastTimestamp: timestamp in seconds of the latest price average.
 * @param {bigint} priceAverage0 latest price average of token0.
 * @param {bigint} priceAverage1 latest price average of token1.
 * @param {bigint} feesLP LP fees
 * @param {bigint} feesPool Pool fees
 * @param {number} forcedPriceAverageTimestamp: current timestamp or timestamp of the trade in seconds.
 * @param {number} maxBlockDiffSeconds: Max block difference in seconds
 * @returns {Object} { currency, amount, amountMax, newResIn, newResOut, newResInFic, newResOutFic }
 */
export function computeAmountOut(
  token0: string,
  token1: string,
  reserve0: bigint,
  reserve1: bigint,
  reserve0Fic: bigint,
  reserve1Fic: bigint,
  tokenAmountIn: bigint,
  tokenAddressIn: string,
  priceAverageLastTimestamp: number,
  priceAverage0: bigint,
  priceAverage1: bigint,
  feesLP: bigint,
  feesPool: bigint,
  forcedPriceAverageTimestamp: number = Math.ceil(Date.now() / 1000) +
    LATENCY_OFFSET_SECONDS,
  maxBlockDiffSeconds = 300,
): CurrencyAmount {
  if (tokenAddressIn === token0) {
    const [newPriceAverage0, newPriceAverage1] = getUpdatedPriceAverage(
      reserve0Fic,
      reserve1Fic,
      priceAverageLastTimestamp,
      priceAverage0,
      priceAverage1,
      forcedPriceAverageTimestamp,
      maxBlockDiffSeconds,
    );

    const [amountOut, newRes0, newRes1, newRes0Fic, newRes1Fic] = getAmountOut(
      tokenAmountIn,
      reserve0,
      reserve1,
      reserve0Fic,
      reserve1Fic,
      newPriceAverage0,
      newPriceAverage1,
      feesLP,
      feesPool,
    );
    // const [amountMax] = getAmountOut(
    //   tokenAmountIn,
    //   reserve0,
    //   reserve1,
    //   reserve0Fic.sub(1).lt(0) ? reserve0Fic : reserve0Fic.sub(1),
    //   reserve1Fic,
    //   newPriceAverage0,
    //   newPriceAverage1,
    // );

    return {
      currency: token1,
      amount: amountOut,
      amountMax: amountOut, // TODO is it still useful ?
      newRes0,
      newRes1,
      newRes0Fic,
      newRes1Fic,
      newPriceAverage0,
      newPriceAverage1,
    };
  }

  // token1 is tokenIn
  const [newPriceAverage1, newPriceAverage0] = getUpdatedPriceAverage(
    reserve1Fic,
    reserve0Fic,
    priceAverageLastTimestamp,
    priceAverage1,
    priceAverage0,
    forcedPriceAverageTimestamp,
    maxBlockDiffSeconds,
  );

  const [amountOut, newRes1, newRes0, newRes1Fic, newRes0Fic] = getAmountOut(
    tokenAmountIn,
    reserve1,
    reserve0,
    reserve1Fic,
    reserve0Fic,
    newPriceAverage1,
    newPriceAverage0,
    feesLP,
    feesPool,
  );
  // const [amountMax] = getAmountOut(
  //   tokenAmountIn,
  //   reserve1,
  //   reserve0,
  //   reserve1Fic.sub(1).lt(0) ? reserve1Fic : reserve1Fic.sub(1),
  //   reserve0Fic,
  //   newPriceAverage1,
  //   newPriceAverage0,
  // );

  return {
    currency: token0,
    amount: amountOut,
    amountMax: amountOut, // TODO is it still useful ?
    newRes0,
    newRes1,
    newRes0Fic,
    newRes1Fic,
    newPriceAverage0,
    newPriceAverage1,
    forcedPriceAverageTimestamp,
  };
}

/**
 * Computes the amount of tokenIn, at the precision of 1 wei.
 * Use case: you want to receive exactly tokenOut amount and want to know the exact tokenIn amount to send.
 * WARNING: token0 and token1 are pair tokens which addresses hexadecimal's values are sorted as token0 < token1.
 * @param {string} token0 the currency address of token0.
 * @param {string} token1 the currency address of token1.
 * @param {bigint} reserve0 the reserves of token0.
 * @param {bigint} reserve1 the reserves of token1.
 * @param {bigint} reserve0Fic the fictionnal reserves of token0.
 * @param {bigint} reserve1Fic the fictionnal reserves of token1.
 * @param {bigint} tokenAmountOut the output amount of the trade.
 * @param {bigint} tokenAddressOut address of the output token.
 * @param {number} priceAverageLastTimestamp timestamp in seconds of the latest price average.
 * @param {bigint} priceAverage0 latest price average of token0.
 * @param {bigint} priceAverage1 latest price average of token1.
 * @param {bigint} feesLP LP fees
 * @param {bigint} feesPool Pool fees
 * @param {number} forcedPriceAverageTimestamp current timestamp or timestamp of the trade in seconds.
 * @param {number} maxBlockDiffSeconds: Max block difference in seconds
 * @returns {Object} { currency, amount, amountMax, newResIn, newResOut, newResInFic, newResOutFic }
 */
export function computeAmountIn(
  token0: string,
  token1: string,
  reserve0: bigint,
  reserve1: bigint,
  reserve0Fic: bigint,
  reserve1Fic: bigint,
  tokenAmountOut: bigint,
  tokenAddressOut: string,
  priceAverageLastTimestamp: number,
  priceAverage0: bigint,
  priceAverage1: bigint,
  feesLP: bigint,
  feesPool: bigint,
  forcedPriceAverageTimestamp: number = Math.ceil(Date.now() / 1000) +
    LATENCY_OFFSET_SECONDS,
  maxBlockDiffSeconds = 300,
): CurrencyAmount {
  if (tokenAddressOut === token0) {
    const [newPriceAverage1, newPriceAverage0] = getUpdatedPriceAverage(
      reserve1Fic,
      reserve0Fic,
      priceAverageLastTimestamp,
      priceAverage1,
      priceAverage0,
      forcedPriceAverageTimestamp,
      maxBlockDiffSeconds,
    );

    const [amountIn, newRes1, newRes0, newRes1Fic, newRes0Fic] = getAmountIn(
      tokenAmountOut,
      reserve1,
      reserve0,
      reserve1Fic,
      reserve0Fic,
      newPriceAverage1,
      newPriceAverage0,
      feesLP,
      feesPool,
    );
    // const [amountMax] = getAmountIn(
    //   tokenAmountOut,
    //   reserve1,
    //   reserve0,
    //   reserve1Fic,
    //   reserve0Fic.sub(1).lt(0) ? reserve0Fic : reserve0Fic.sub(1),
    //   newPriceAverage1,
    //   newPriceAverage0,
    // );

    return {
      currency: token1,
      amount: amountIn,
      amountMax: amountIn, // TODO is it still useful ?
      newRes0,
      newRes1,
      newRes0Fic,
      newRes1Fic,
      newPriceAverage0,
      newPriceAverage1,
    };
  }

  // token1 is tokenOut
  const [newPriceAverage0, newPriceAverage1] = getUpdatedPriceAverage(
    reserve0Fic,
    reserve1Fic,
    priceAverageLastTimestamp,
    priceAverage0,
    priceAverage1,
    forcedPriceAverageTimestamp,
    maxBlockDiffSeconds,
  );

  const [amountIn, newRes0, newRes1, newRes0Fic, newRes1Fic] = getAmountIn(
    tokenAmountOut,
    reserve0,
    reserve1,
    reserve0Fic,
    reserve1Fic,
    newPriceAverage0,
    newPriceAverage1,
    feesLP,
    feesPool,
  );

  // const [amountMax] = getAmountIn(
  //   tokenAmountOut,
  //   reserve0,
  //   reserve1,
  //   reserve0Fic,
  //   reserve1Fic.sub(1).lt(0) ? reserve1Fic : reserve1Fic.sub(1),
  //   newPriceAverage0,
  //   newPriceAverage1,
  // );

  return {
    currency: token0,
    amount: amountIn,
    amountMax: amountIn, // TODO is it still useful ?
    newRes0,
    newRes1,
    newRes0Fic,
    newRes1Fic,
    newPriceAverage0,
    newPriceAverage1,
    forcedPriceAverageTimestamp,
  };
}

/**
 * Extracts the token addresses composing the route ordered in the route's direction starting with inputCurrency.
 * @param {Pair[]} pairs array of pairs composing the trade.
 * @param {string} inputCurrency the currency from which the route starts.
 * @return {string[]} Array of token addresses composing the route ordered in the route's direction starting with inputCurrency.
 */
export function getPathFromInput(
  pairs: Pair[],
  inputCurrency: string,
): string[] {
  const path: string[] = [];
  for (let i = 0; i < pairs.length; i += 1) {
    const pairCurrencyIn =
      path.length === 0 ? inputCurrency : path[path.length - 1];
    const [tokenIn, tokenOut] =
      pairCurrencyIn === pairs[i].token0
        ? [pairs[i].token0, pairs[i].token1]
        : [pairs[i].token1, pairs[i].token0];
    if (path.length === 0) {
      path.push(tokenIn);
    }
    path.push(tokenOut);
  }
  return path;
}

/**
 * Extracts the token addresses composing the route ordered in the route's direction ending with outputCurrency.
 * @param {Pair[]} pairs array of pairs composing the trade.
 * @param {string} outputCurrency the currency for which the route finishes.
 * @return {string[]} Array of token addresses composing the route ordered in the route's direction ending with outputCurrency.
 */
export function getPathFromOutput(
  pairs: Pair[],
  outputCurrency: string,
): string[] {
  const path: string[] = [];
  for (let i = pairs.length - 1; i >= 0; i -= 1) {
    const pairCurrencyOut =
      path.length === 0 ? outputCurrency : path[path.length - 1];
    const [tokenOut, tokenIn] =
      pairCurrencyOut === pairs[i].token0
        ? [pairs[i].token0, pairs[i].token1]
        : [pairs[i].token1, pairs[i].token0];
    if (path.length === 0) {
      path.push(tokenOut);
    }
    path.push(tokenIn);
  }
  return path.reverse();
}
