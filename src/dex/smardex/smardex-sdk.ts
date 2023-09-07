import { BigNumber, constants, utils } from 'ethers/lib/ethers';

// Protocol's fees constants
export const FEES_LP = BigNumber.from(500);
export const FEES_POOL = BigNumber.from(200);
export const FEES_TOTAL = FEES_LP.add(FEES_POOL);
export const FEES_BASE = BigNumber.from(1000);
export const FEES_TOTAL_REVERSED = FEES_BASE.sub(FEES_TOTAL);
export interface Pair {
  address?: string;
  token0: string;
  token1: string;
  reserve0: BigNumber;
  reserve1: BigNumber;
  reserve0LastFictive: BigNumber;
  reserve1LastFictive: BigNumber;
  priceAverageLastTimestamp: number;
  priceAverage0: BigNumber;
  priceAverage1: BigNumber;
  forcedPriceAverageTimestamp?: number;
  prevReserveFic0?: BigNumber;
  prevReserveFic1?: BigNumber;
}

export interface CurrencyAmount {
  currency: string;
  amount: BigNumber;
  amountMax?: BigNumber;
  newRes0?: BigNumber;
  newRes1?: BigNumber;
  newRes0Fic?: BigNumber;
  newRes1Fic?: BigNumber;
  newPriceAverage0?: BigNumber;
  newPriceAverage1?: BigNumber;
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
  priceImpact?: BigNumber; // defined only after calling bestTradeExactIn or bestTradeExactOut
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
// compute first trade amountIn using arbitrage feature
// function computeFirstTradeQtyIn(
//   amountIn: BigNumber,
//   reserveInFic: BigNumber,
//   reserveOutFic: BigNumber,
//   priceAverageIn: BigNumber,
//   priceAverageOut: BigNumber,
// ): BigNumber {
//   // default value
//   let firstAmountIn = amountIn;

//   // if trade is in the good direction
//   if (reserveOutFic.mul(priceAverageIn).gt(reserveInFic.mul(priceAverageOut))) {
//     // pre-compute all operands
//     const toSub = reserveInFic.mul(
//       FEES_BASE.add(FEES_TOTAL_REVERSED).sub(FEES_POOL),
//     );
//     const toDiv = FEES_TOTAL_REVERSED.add(FEES_LP).mul(2);
//     const inSqrt = reserveInFic
//       .mul(reserveOutFic)
//       .mul(4)
//       .div(priceAverageOut)
//       .mul(priceAverageIn)
//       .mul(FEES_TOTAL_REVERSED)
//       .mul(FEES_BASE.sub(FEES_POOL))
//       .add(reserveInFic.mul(reserveInFic).mul(FEES_LP).mul(FEES_LP));

//     // reverse sqrt check to only compute sqrt if really needed
//     if (inSqrt.lt(amountIn.mul(toDiv).add(toSub).pow(2))) {
//       firstAmountIn = sqrt(inSqrt).sub(toSub).div(toDiv);
//     }
//   }

//   return firstAmountIn;
// }

function computeFirstTradeQtyIn(
  amountIn: BigNumber,
  reserveInFic: BigNumber,
  reserveOutFic: BigNumber,
  priceAverageIn: BigNumber,
  priceAverageOut: BigNumber,
  feesLP: BigNumber,
  feesPool: BigNumber,
): BigNumber {
  // default value
  let firstAmountIn = amountIn;

  // if trade is in the good direction
  if (reserveOutFic.mul(priceAverageIn).gt(reserveInFic.mul(priceAverageOut))) {
    // pre-compute all operands
    const feesTotalReversed = FEES_BASE.sub(feesLP).sub(feesPool);

    const toSub = reserveInFic.mul(
      FEES_BASE.add(feesTotalReversed).sub(feesPool),
    );

    const toDiv = feesTotalReversed.add(feesLP).mul(2);

    const inSqrt = reserveInFic
      .mul(reserveOutFic)
      .mul(4)
      .div(priceAverageOut)
      .mul(priceAverageIn)
      .mul(feesTotalReversed)
      .mul(FEES_BASE.sub(feesPool))
      .add(reserveInFic.mul(reserveInFic).mul(feesLP).mul(feesLP));

    // reverse sqrt check to only compute sqrt if really needed
    if (inSqrt.lt(amountIn.mul(toDiv).add(toSub).pow(2))) {
      firstAmountIn = sqrt(inSqrt).sub(toSub).div(toDiv);
    }
  }

  return firstAmountIn;
}

// // compute first trade amountOut using arbitrage feature
// function computeFirstTradeQtyOut(
//   amountOut: BigNumber,
//   reserveInFic: BigNumber,
//   reserveOutFic: BigNumber,
//   priceAverageIn: BigNumber,
//   priceAverageOut: BigNumber,
// ): BigNumber {
//   // default value
//   let firstAmountOut = amountOut;

//   // if trade is in the good direction
//   if (reserveOutFic.mul(priceAverageIn).gt(reserveInFic.mul(priceAverageOut))) {
//     // pre-compute all operands
//     const reserveOutFicPredictedFees = reserveInFic
//       .mul(FEES_LP)
//       .mul(priceAverageOut)
//       .div(priceAverageIn);
//     const toAdd = reserveOutFic
//       .mul(FEES_TOTAL_REVERSED)
//       .mul(2)
//       .add(reserveOutFicPredictedFees);
//     const toDiv = FEES_TOTAL_REVERSED.mul(2);
//     const inSqrt = reserveOutFic
//       .mul(reserveOutFicPredictedFees)
//       .mul(4)
//       .mul(FEES_TOTAL_REVERSED)
//       .mul(FEES_BASE.sub(FEES_POOL))
//       .div(FEES_LP)
//       .add(reserveOutFicPredictedFees.pow(2));

//     // reverse sqrt check to only compute sqrt if really needed
//     if (inSqrt.gt(toAdd.sub(amountOut.mul(toDiv)).pow(2))) {
//       firstAmountOut = toAdd.sub(sqrt(inSqrt)).div(toDiv);
//     }
//   }

//   return firstAmountOut;
// }

// compute first trade amountOut using arbitrage feature
function computeFirstTradeQtyOut(
  amountOut: BigNumber,
  reserveInFic: BigNumber,
  reserveOutFic: BigNumber,
  priceAverageIn: BigNumber,
  priceAverageOut: BigNumber,
  feesLP: BigNumber,
  feesPool: BigNumber,
): BigNumber {
  // default value
  let firstAmountOut = amountOut;

  // if trade is in the good direction
  if (reserveOutFic.mul(priceAverageIn).gt(reserveInFic.mul(priceAverageOut))) {
    // pre-compute all operands
    const feesTotalReversed = FEES_BASE.sub(feesLP).sub(feesPool);

    const reserveOutFicPredictedFees = reserveInFic
      .mul(feesLP)
      .mul(priceAverageOut)
      .div(priceAverageIn);

    const toAdd = reserveOutFic
      .mul(feesTotalReversed)
      .mul(2)
      .add(reserveOutFicPredictedFees);

    const toDiv = feesTotalReversed.mul(2);

    const inSqrt = reserveOutFic
      .mul(reserveOutFicPredictedFees)
      .mul(4)
      .mul(feesTotalReversed)
      .mul(FEES_BASE.sub(feesPool))
      .div(feesLP)
      .add(reserveOutFicPredictedFees.pow(2));

    // reverse sqrt check to only compute sqrt if really needed
    if (inSqrt.gt(toAdd.sub(amountOut.mul(toDiv)).pow(2))) {
      firstAmountOut = toAdd.sub(sqrt(inSqrt)).div(toDiv);
    }
  }

  return firstAmountOut;
}

// apply uniswap k const rule. amountIn -> amountOut
// return [amountOut, newResIn, newResOut, newResInFic, newResOutFic]
function applyKConstRuleOut(
  amountIn: BigNumber,
  reserveIn: BigNumber,
  reserveOut: BigNumber,
  reserveInFic: BigNumber,
  reserveOutFic: BigNumber,
  feesLP: BigNumber,
  feesPool: BigNumber,
): [BigNumber, BigNumber, BigNumber, BigNumber, BigNumber] {
  // k const rule
  const feesTotalReversed = FEES_BASE.sub(feesLP).sub(feesPool);
  const amountInWithFee = amountIn.mul(feesTotalReversed);
  const numerator = amountInWithFee.mul(reserveOutFic);
  const denominator = reserveInFic.mul(FEES_BASE).add(amountInWithFee);

  if (denominator.eq(0)) {
    throw new Error('SMARDEX_K_ERROR');
  }

  const amountOut = numerator.div(denominator);

  // update new reserves and add lp-fees to pools
  const amountInWithFeeLp = amountIn
    .mul(feesLP)
    .add(amountInWithFee)
    .div(FEES_BASE);
  const newResIn = reserveIn.add(amountInWithFeeLp);
  const newResInFic = reserveInFic.add(amountInWithFeeLp);
  const newResOut = reserveOut.sub(amountOut);
  const newResOutFic = reserveOutFic.sub(amountOut);

  return [amountOut, newResIn, newResOut, newResInFic, newResOutFic];
}

// // apply uniswap k const rule. amountIn -> amountOut
// // return [amountOut, newResIn, newResOut, newResInFic, newResOutFic]
// function applyKConstRuleOut(
//   amountIn: BigNumber,
//   reserveIn: BigNumber,
//   reserveOut: BigNumber,
//   reserveInFic: BigNumber,
//   reserveOutFic: BigNumber,
// ): [BigNumber, BigNumber, BigNumber, BigNumber, BigNumber] {
//   // k const rule
//   const amountInWithFee = amountIn.mul(FEES_TOTAL_REVERSED);
//   const numerator = amountInWithFee.mul(reserveOutFic);
//   const denominator = reserveInFic.mul(FEES_BASE).add(amountInWithFee);
//   if (denominator.eq(0)) throw new Error('SMARDEX_K_ERROR');

//   const amountOut = numerator.div(denominator);

//   // update new reserves and add lp-fees to pools
//   const amountInWithFeeLp = amountIn
//     .mul(FEES_LP)
//     .add(amountInWithFee)
//     .div(FEES_BASE);
//   const newResIn = reserveIn.add(amountInWithFeeLp);
//   const newResInFic = reserveInFic.add(amountInWithFeeLp);
//   const newResOut = reserveOut.sub(amountOut);
//   const newResOutFic = reserveOutFic.sub(amountOut);

//   return [amountOut, newResIn, newResOut, newResInFic, newResOutFic];
// }

// // apply uniswap k const rule.  amountOut -> amountIn
// // returns [amountIn, newResIn, newResOut, newResInFic, newResOutFic]
// function applyKConstRuleIn(
//   amountOut: BigNumber,
//   reserveIn: BigNumber,
//   reserveOut: BigNumber,
//   reserveInFic: BigNumber,
//   reserveOutFic: BigNumber,
// ): [BigNumber, BigNumber, BigNumber, BigNumber, BigNumber] {
//   // k const rule
//   const numerator = reserveInFic.mul(amountOut).mul(FEES_BASE);
//   const denominator = reserveOutFic.sub(amountOut).mul(FEES_TOTAL_REVERSED);
//   if (denominator.eq(0)) throw new Error('SMARDEX_K_ERROR');

//   const amountIn = numerator.div(denominator).add(1);

//   // update new reserves
//   const amountInWithFeeLp = FEES_TOTAL_REVERSED.add(FEES_LP)
//     .mul(amountIn)
//     .div(FEES_BASE);
//   const newResIn = reserveIn.add(amountInWithFeeLp);
//   const newResInFic = reserveInFic.add(amountInWithFeeLp);
//   const newResOut = reserveOut.sub(amountOut);
//   const newResOutFic = reserveOutFic.sub(amountOut);

//   return [amountIn, newResIn, newResOut, newResInFic, newResOutFic];
// }

function applyKConstRuleIn(
  amountOut: BigNumber,
  reserveIn: BigNumber,
  reserveOut: BigNumber,
  reserveInFic: BigNumber,
  reserveOutFic: BigNumber,
  feesLP: BigNumber,
  feesPool: BigNumber,
): [BigNumber, BigNumber, BigNumber, BigNumber, BigNumber] {
  // k const rule
  const feesTotalReversed = FEES_BASE.sub(feesLP).sub(feesPool);
  const numerator = reserveInFic.mul(amountOut).mul(FEES_BASE);
  const denominator = reserveOutFic.sub(amountOut).mul(feesTotalReversed);

  if (denominator.eq(0)) {
    throw new Error('SMARDEX_K_ERROR');
  }

  const amountIn = numerator.div(denominator.add(1));

  // update new reserves
  const amountInWithFeeLp = feesTotalReversed
    .add(feesLP)
    .mul(amountIn)
    .div(FEES_BASE);
  const newResIn = reserveIn.add(amountInWithFeeLp);
  const newResInFic = reserveInFic.add(amountInWithFeeLp);
  const newResOut = reserveOut.sub(amountOut);
  const newResOutFic = reserveOutFic.sub(amountOut);

  return [amountIn, newResIn, newResOut, newResInFic, newResOutFic];
}

/**
 * Compute fictive reserves based on current reserves state
 *
 * @param {BigNumber} reserveIn the reserves of input token.
 * @param {BigNumber} reserveOut the reserves of output token.
 * @param {BigNumber} reserveInFic the fictive reserves of input token.
 * @param {BigNumber} reserveOutFic the fictive reserves of output token.
 * @returns {Array} [ficIn, ficOut]
 */
export function computeReserveFic(
  reserveIn: BigNumber,
  reserveOut: BigNumber,
  reserveInFic: BigNumber,
  reserveOutFic: BigNumber,
): [BigNumber, BigNumber] {
  if (reserveOut.mul(reserveInFic).lt(reserveIn.mul(reserveOutFic))) {
    const temp = reserveOut
      .mul(reserveOut)
      .div(reserveOutFic)
      .mul(reserveInFic)
      .div(reserveIn);
    const newResFicIn = temp
      .mul(reserveInFic)
      .div(reserveOutFic)
      .add(reserveOut.mul(reserveInFic).div(reserveOutFic));
    const newResFicOut = reserveOut.add(temp);

    return [newResFicIn.div(4), newResFicOut.div(4)];
  }
  const newResFicIn = reserveInFic
    .mul(reserveOut)
    .div(reserveOutFic)
    .add(reserveIn);
  const newResFicOut = reserveIn
    .mul(reserveOutFic)
    .div(reserveInFic)
    .add(reserveOut);

  return [newResFicIn.div(4), newResFicOut.div(4)];
}

/**
 * Simulate a full trasaction, if you know the "in" token quantity, provide you the "out" and all reserves change
 * Use case: you want to receive exactly amountOut and want to know the exact amountIn to send.
 * @param {BigNumber} amountIn the desired input amount of the trade.
 * @param {BigNumber} reserveIn the reserves of input token.
 * @param {BigNumber} reserveOut the reserves of output token.
 * @param {BigNumber} reserveInFic the fictive reserves of input token.
 * @param {BigNumber} reserveOutFic the fictive reserves of output token.
 * @param {BigNumber} priceAverageIn the price average of input token.
 * @param {BigNumber} priceAverageOut the price average of output token.
 * @returns {Array} [amountOut, newResIn, newResOut, newResInFic, newResOutFic]
 */
// export function getAmountOut(
//   amountIn: BigNumber,
//   reserveIn: BigNumber,
//   reserveOut: BigNumber,
//   reserveInFic: BigNumber,
//   reserveOutFic: BigNumber,
//   priceAverageIn: BigNumber,
//   priceAverageOut: BigNumber,
// ): [BigNumber, BigNumber, BigNumber, BigNumber, BigNumber] {
//   if (amountIn.lt(0)) throw new Error('INSUFFICIENT_INPUT_AMOUNT');
//   if (reserveIn.lt(0) || reserveOut.lt(0))
//     throw new Error('INSUFFICIENT_LIQUIDITY');
//   if (reserveInFic.lt(0) || reserveOutFic.lt(0))
//     throw new Error('INSUFFICIENT_LIQUIDITY');

//   let reserveInFicUpdated = BigNumber.from(reserveInFic);
//   let reserveOutFicUpdated = BigNumber.from(reserveOutFic);

//   const amountWithFees = amountIn.mul(FEES_TOTAL_REVERSED).div(FEES_BASE);
//   const firstAmount = computeFirstTradeQtyIn(
//     amountWithFees,
//     reserveInFic,
//     reserveOutFic,
//     priceAverageIn,
//     priceAverageOut,
//   );

//   // if there are 2 trades: 1st trade mustn't re-compute ReserveFic, 2nd should
//   if (
//     firstAmount.eq(amountWithFees) &&
//     ratioApproxEq(reserveInFic, reserveOutFic, priceAverageIn, priceAverageOut)
//   ) {
//     [reserveInFicUpdated, reserveOutFicUpdated] = computeReserveFic(
//       reserveIn,
//       reserveOut,
//       reserveInFic,
//       reserveOutFic,
//     );
//   }

//   // Avoid K constant division by 0
//   if (reserveInFicUpdated.lte('0'))
//     return [
//       utils.parseEther('0'),
//       reserveIn,
//       reserveOut,
//       reserveInFicUpdated,
//       reserveOutFicUpdated,
//     ];

//   const firstAmountNoFees = firstAmount.mul(FEES_BASE).div(FEES_TOTAL_REVERSED);
//   let [amountOut, newResIn, newResOut, newResInFic, newResOutFic] =
//     applyKConstRuleOut(
//       firstAmountNoFees,
//       reserveIn,
//       reserveOut,
//       reserveInFicUpdated,
//       reserveOutFicUpdated,
//     );

//   // if we need a second trade
//   if (firstAmount.lt(amountWithFees) && firstAmountNoFees.lt(amountIn)) {
//     [newResInFic, newResOutFic] = computeReserveFic(
//       newResIn,
//       newResOut,
//       newResInFic,
//       newResOutFic,
//     );

//     // Avoid K constant division by 0
//     if (newResInFic.lte('0'))
//       return [
//         utils.parseEther('0'),
//         reserveIn,
//         reserveOut,
//         reserveInFicUpdated,
//         reserveOutFicUpdated,
//       ];

//     let secondAmountOutNoFees: BigNumber;
//     [secondAmountOutNoFees, newResIn, newResOut, newResInFic, newResOutFic] =
//       applyKConstRuleOut(
//         amountIn.sub(firstAmountNoFees),
//         newResIn,
//         newResOut,
//         newResInFic,
//         newResOutFic,
//       );
//     amountOut = amountOut.add(secondAmountOutNoFees);
//   }

//   if (
//     newResIn.lte(0) ||
//     newResOut.lte(0) ||
//     newResInFic.lte(0) ||
//     newResOutFic.lte(0)
//   ) {
//     throw new Error('INSUFFICIENT_LIQUIDITY');
//   }
//   return [amountOut, newResIn, newResOut, newResInFic, newResOutFic];
// }

/**
 * Simulate a full trasaction, if you know the "in" token quantity, provide you the "out" and all reserves change
 * Use case: you want to receive exactly amountOut and want to know the exact amountIn to send.
 * @param {BigNumber} amountIn the desired input amount of the trade.
 * @param {BigNumber} reserveIn the reserves of input token.
 * @param {BigNumber} reserveOut the reserves of output token.
 * @param {BigNumber} reserveInFic the fictive reserves of input token.
 * @param {BigNumber} reserveOutFic the fictive reserves of output token.
 * @param {BigNumber} priceAverageIn the price average of input token.
 * @param {BigNumber} priceAverageOut the price average of output token.
 * @param {BigNumber} feesLP LP fees
 * @param {BigNumber} feesPool Pool fees
 * @returns {Array} [amountOut, newResIn, newResOut, newResInFic, newResOutFic]
 */
export function getAmountOut(
  amountIn: BigNumber,
  reserveIn: BigNumber,
  reserveOut: BigNumber,
  reserveInFic: BigNumber,
  reserveOutFic: BigNumber,
  priceAverageIn: BigNumber,
  priceAverageOut: BigNumber,
  feesLP: BigNumber,
  feesPool: BigNumber,
): [BigNumber, BigNumber, BigNumber, BigNumber, BigNumber] {
  // if (amountIn.lte(0)) {
  //   console.log("amountIn", amountIn)
  //   throw new Error('INSUFFICIENT_INPUT_AMOUNT');
  // }

  if (reserveIn.lte(0) || reserveOut.lte(0)) {
    throw new Error('INSUFFICIENT_LIQUIDITY');
  }

  if (reserveInFic.lte(0) || reserveOutFic.lte(0)) {
    throw new Error('INSUFFICIENT_LIQUIDITY');
  }

  if (priceAverageIn.lte(0) || priceAverageOut.lte(0)) {
    throw new Error('INSUFFICIENT_PRICE_AVERAGE');
  }

  let reserveInFicUpdated = reserveInFic;
  let reserveOutFicUpdated = reserveOutFic;

  const feesTotalReversed = FEES_BASE.sub(feesLP).sub(feesPool);

  const amountWithFees = amountIn.mul(feesTotalReversed).div(FEES_BASE);

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
  if (reserveInFicUpdated.lte(0)) {
    return [
      BigNumber.from(0),
      reserveIn,
      reserveOut,
      reserveInFicUpdated,
      reserveOutFicUpdated,
    ];
  }

  const firstAmountNoFees = firstAmount.mul(FEES_BASE).div(feesTotalReversed);

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
  if (firstAmount.lt(amountWithFees) && firstAmountNoFees.lt(amountIn)) {
    [newResInFic, newResOutFic] = computeReserveFic(
      newResIn,
      newResOut,
      newResInFic,
      newResOutFic,
    );

    // Avoid K constant division by 0
    if (newResInFic.lte(0)) {
      return [
        BigNumber.from(0),
        reserveIn,
        reserveOut,
        reserveInFicUpdated,
        reserveOutFicUpdated,
      ];
    }

    let secondAmountOutNoFees: BigNumber;

    [secondAmountOutNoFees, newResIn, newResOut, newResInFic, newResOutFic] =
      applyKConstRuleOut(
        amountIn.sub(firstAmountNoFees),
        newResIn,
        newResOut,
        newResInFic,
        newResOutFic,
        feesLP,
        feesPool,
      );

    amountOut = amountOut.add(secondAmountOutNoFees);
  }

  if (
    newResIn.lte(0) ||
    newResOut.lte(0) ||
    newResInFic.lte(0) ||
    newResOutFic.lte(0)
  ) {
    throw new Error('INSUFFICIENT_LIQUIDITY');
  }

  return [amountOut, newResIn, newResOut, newResInFic, newResOutFic];
}

// /**
//  * Simulate a full transaction, if you know the "out" token quantity, provide you the "in" and all reserves change
//  * Use case: you want to receive exactly amountOut and want to know the exact amountIn to send.
//  * @param {BigNumber} amountOut the desired output amount of the trade.
//  * @param {BigNumber} reserveIn the reserves of input token.
//  * @param {BigNumber} reserveOut the reserves of output token.
//  * @param {BigNumber} reserveInFic the fictive reserves of input token.
//  * @param {BigNumber} reserveOutFic the fictive reserves of output token.
//  * @param {BigNumber} priceAverageIn the price average of input token.
//  * @param {BigNumber} priceAverageOut the price average of output token.
//  * @returns {Array} [amountIn, newResIn, newResOut, newResInFic, newResOutFic]
//  */
// export function getAmountIn(
//   amountOut: BigNumber,
//   reserveIn: BigNumber,
//   reserveOut: BigNumber,
//   reserveInFic: BigNumber,
//   reserveOutFic: BigNumber,
//   priceAverageIn: BigNumber,
//   priceAverageOut: BigNumber,
// ): [BigNumber, BigNumber, BigNumber, BigNumber, BigNumber] {
//   if (amountOut.lt(0)) throw new Error('INSUFFICIENT_OUTPUT_AMOUNT');
//   if (reserveIn.lt(0) || reserveOut.lt(0))
//     throw new Error('INSUFFICIENT_LIQUIDITY');
//   if (reserveInFic.lt(0) || reserveOutFic.lt(0))
//     throw new Error('INSUFFICIENT_LIQUIDITY');

//   let reserveInFicUpdated = BigNumber.from(reserveInFic);
//   let reserveOutFicUpdated = BigNumber.from(reserveOutFic);

//   const firstAmount = computeFirstTradeQtyOut(
//     amountOut,
//     reserveInFic,
//     reserveOutFic,
//     priceAverageIn,
//     priceAverageOut,
//   );

//   // if there are 2 trades: 1st trade mustn't re-compute ReserveFic, 2nd should
//   if (
//     firstAmount.eq(amountOut) &&
//     ratioApproxEq(reserveInFic, reserveOutFic, priceAverageIn, priceAverageOut)
//   ) {
//     [reserveInFicUpdated, reserveOutFicUpdated] = computeReserveFic(
//       reserveIn,
//       reserveOut,
//       reserveInFic,
//       reserveOutFic,
//     );
//   }

//   // Avoid K constant division by 0
//   if (reserveInFic.lte('0'))
//     return [
//       utils.parseEther('0'),
//       reserveIn,
//       reserveOut,
//       reserveInFicUpdated,
//       reserveOutFicUpdated,
//     ];

//   let [amountIn, newResIn, newResOut, newResInFic, newResOutFic] =
//     applyKConstRuleIn(
//       firstAmount,
//       reserveIn,
//       reserveOut,
//       reserveInFicUpdated,
//       reserveOutFicUpdated,
//     );

//   // if we need a second trade
//   if (firstAmount.lt(amountOut)) {
//     // in the second trade ALWAYS recompute fictive reserves
//     [newResInFic, newResOutFic] = computeReserveFic(
//       newResIn,
//       newResOut,
//       newResInFic,
//       newResOutFic,
//     );

//     // Avoid K constant division by 0
//     if (newResInFic.lte('0'))
//       return [
//         utils.parseEther('0'),
//         reserveIn,
//         reserveOut,
//         reserveInFicUpdated,
//         reserveOutFicUpdated,
//       ];

//     let secondAmountIn: BigNumber;
//     [secondAmountIn, newResIn, newResOut, newResInFic, newResOutFic] =
//       applyKConstRuleIn(
//         amountOut.sub(firstAmount),
//         newResIn,
//         newResOut,
//         newResInFic,
//         newResOutFic,
//       );
//     amountIn = amountIn.add(secondAmountIn);
//   }

//   if (
//     newResIn.lte(0) ||
//     newResOut.lte(0) ||
//     newResInFic.lte(0) ||
//     newResOutFic.lte(0)
//   ) {
//     throw new Error('INSUFFICIENT_LIQUIDITY');
//   }
//   return [amountIn, newResIn, newResOut, newResInFic, newResOutFic];
// }

/**
 * Simulate a full transaction, if you know the "out" token quantity, provide you the "in" and all reserves change
 * Use case: you want to receive exactly amountOut and want to know the exact amountIn to send.
 * @param {BigNumber} amountOut the desired output amount of the trade.
 * @param {BigNumber} reserveIn the reserves of input token.
 * @param {BigNumber} reserveOut the reserves of output token.
 * @param {BigNumber} reserveInFic the fictive reserves of input token.
 * @param {BigNumber} reserveOutFic the fictive reserves of output token.
 * @param {BigNumber} priceAverageIn the price average of input token.
 * @param {BigNumber} priceAverageOut the price average of output token.
 * @param {BigNumber} feesLP LP fees
 * @param {BigNumber} feesPool Pool fees
 * @returns {Array} [amountIn, newResIn, newResOut, newResInFic, newResOutFic]
 */
export function getAmountIn(
  amountOut: BigNumber,
  reserveIn: BigNumber,
  reserveOut: BigNumber,
  reserveInFic: BigNumber,
  reserveOutFic: BigNumber,
  priceAverageIn: BigNumber,
  priceAverageOut: BigNumber,
  feesLP: BigNumber,
  feesPool: BigNumber,
): [BigNumber, BigNumber, BigNumber, BigNumber, BigNumber] {
  if (amountOut.lte(0)) {
    throw new Error('INSUFFICIENT_OUTPUT_AMOUNT');
  }

  if (reserveIn.lte(0) || reserveOut.lte(0)) {
    throw new Error('INSUFFICIENT_LIQUIDITY');
  }

  if (reserveInFic.lte(0) || reserveOutFic.lte(0)) {
    throw new Error('INSUFFICIENT_LIQUIDITY');
  }

  if (priceAverageIn.lte(0) || priceAverageOut.lte(0)) {
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
  if (reserveInFic.lte(0)) {
    return [
      BigNumber.from(0),
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
  if (firstAmount.lt(amountOut)) {
    // in the second trade ALWAYS recompute fictive reserves
    [newResInFic, newResOutFic] = computeReserveFic(
      newResIn,
      newResOut,
      newResInFic,
      newResOutFic,
    );

    // Avoid K constant division by 0
    if (newResInFic.lte(0)) {
      return [
        BigNumber.from(0),
        reserveIn,
        reserveOut,
        reserveInFicUpdated,
        reserveOutFicUpdated,
      ];
    }

    let secondAmountIn: BigNumber;

    [secondAmountIn, newResIn, newResOut, newResInFic, newResOutFic] =
      applyKConstRuleIn(
        amountOut.sub(firstAmount),
        newResIn,
        newResOut,
        newResInFic,
        newResOutFic,
        feesLP,
        feesPool,
      );

    amountIn = amountIn.add(secondAmountIn);
  }

  if (
    newResIn.lte(0) ||
    newResOut.lte(0) ||
    newResInFic.lte(0) ||
    newResOutFic.lte(0)
  ) {
    throw new Error('INSUFFICIENT_LIQUIDITY');
  }

  return [amountIn, newResIn, newResOut, newResInFic, newResOutFic];
}

/**
 * Computes the priceAverageIn and priceAverageOut.
 * Use case: you want to send an exact amount of tokenIn and know exactly how much you it will give you of tokenOut.
 * Price averages are modified only if current timestamp does not match last timestamp
 * @param {BigNumber} reserveFicIn the fictuve reserves of input token.
 * @param {BigNumber} reserveFicOut the fictuve reserves of output token.
 * @param {number} priceAverageLastTimestamp last timestamp in seconds of price average values.
 * @param {BigNumber} priceAverageIn the latest price average of input token.
 * @param {BigNumber} priceAverageOut the latest price average of output token.
 * @param {number} currentTimestampInSecond current timestamp in seconds.
 * @returns {Array} [priceAverageIn, priceAverageOut]
 */
export function getUpdatedPriceAverage(
  reserveFicIn: BigNumber,
  reserveFicOut: BigNumber,
  priceAverageLastTimestamp: number,
  priceAverageIn: BigNumber,
  priceAverageOut: BigNumber,
  currentTimestampInSecond: number,
): [BigNumber, BigNumber] {
  if (BigNumber.from(currentTimestampInSecond).lt(priceAverageLastTimestamp))
    throw new Error('INVALID_TIMESTAMP');

  // very first time
  if (
    priceAverageLastTimestamp === 0 ||
    priceAverageIn.eq(0) ||
    priceAverageOut.eq(0)
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
    MAX_BLOCK_DIFF_SECONDS,
  );

  const priceAverageInRet = reserveFicIn;
  const priceAverageOutRet = priceAverageOut
    .mul(priceAverageInRet)
    .mul(MAX_BLOCK_DIFF_SECONDS - timeDiff)
    .div(priceAverageIn)
    .add(reserveFicOut.mul(timeDiff))
    .div(MAX_BLOCK_DIFF_SECONDS);

  return [priceAverageInRet, priceAverageOutRet];
}

// /**
//  * Computes the amount of tokenOut, at the precision of 1 wei.
//  * Use case: you want to send an exact amount of tokenIn and know exactly how much you it will give you of tokenOut.
//  * WARNING: token0 and token1 are pair tokens which addresses hexadecimal's values are sorted as token0 < token1.
//  * @param {string} token0 the currency address of token0.
//  * @param {string} token1 the currency address of token1.
//  * @param {BigNumber} reserve0 the reserves of token0.
//  * @param {BigNumber} reserve1 the reserves of token1.
//  * @param {BigNumber} reserve0Fic the fictionnal reserves of token0.
//  * @param {BigNumber} reserve1Fic the fictionnal reserves of token1.
//  * @param {BigNumber} tokenAmountIn the input amount of the trade.
//  * @param {BigNumber} tokenAddressIn address of the input token.
//  * @param {number} priceAverageLastTimestamp: timestamp in seconds of latest price average.
//  * @param {BigNumber} priceAverage0 latest price average of token0.
//  * @param {BigNumber} priceAverage1 latest price average of token1.
//  * @param {number} forcedPriceAverageTimestamp: current timestamp or timestamp of the trade in seconds.
//  * @returns {Object} { currency, amount, amountMax, newResIn, newResOut, newResInFic, newResOutFic }
//  */
// export function computeAmountOut(
//   token0: string,
//   token1: string,
//   reserve0: BigNumber,
//   reserve1: BigNumber,
//   reserve0Fic: BigNumber,
//   reserve1Fic: BigNumber,
//   tokenAmountIn: BigNumber,
//   tokenAddressIn: string,
//   priceAverageLastTimestamp: number,
//   priceAverage0: BigNumber,
//   priceAverage1: BigNumber,
//   forcedPriceAverageTimestamp: number = Math.ceil(Date.now() / 1000) +
//     LATENCY_OFFSET_SECONDS,
// ): CurrencyAmount {
//   if (tokenAddressIn === token0) {
//     const [newPriceAverage0, newPriceAverage1] = getUpdatedPriceAverage(
//       reserve0Fic,
//       reserve1Fic,
//       priceAverageLastTimestamp,
//       priceAverage0,
//       priceAverage1,
//       forcedPriceAverageTimestamp,
//     );

//     const [amountOut, newRes0, newRes1, newRes0Fic, newRes1Fic] = getAmountOut(
//       tokenAmountIn,
//       reserve0,
//       reserve1,
//       reserve0Fic,
//       reserve1Fic,
//       newPriceAverage0,
//       newPriceAverage1,
//     );
//     // const [amountMax] = getAmountOut(
//     //   tokenAmountIn,
//     //   reserve0,
//     //   reserve1,
//     //   reserve0Fic.sub(1).lt(0) ? reserve0Fic : reserve0Fic.sub(1),
//     //   reserve1Fic,
//     //   newPriceAverage0,
//     //   newPriceAverage1,
//     // );

//     return {
//       currency: token1,
//       amount: amountOut,
//       amountMax: amountOut, // TODO is it still useful ?
//       newRes0,
//       newRes1,
//       newRes0Fic,
//       newRes1Fic,
//       newPriceAverage0,
//       newPriceAverage1,
//     };
//   }

//   // token1 is tokenIn
//   const [newPriceAverage1, newPriceAverage0] = getUpdatedPriceAverage(
//     reserve1Fic,
//     reserve0Fic,
//     priceAverageLastTimestamp,
//     priceAverage1,
//     priceAverage0,
//     forcedPriceAverageTimestamp,
//   );

//   const [amountOut, newRes1, newRes0, newRes1Fic, newRes0Fic] = getAmountOut(
//     tokenAmountIn,
//     reserve1,
//     reserve0,
//     reserve1Fic,
//     reserve0Fic,
//     newPriceAverage1,
//     newPriceAverage0,
//   );
//   // const [amountMax] = getAmountOut(
//   //   tokenAmountIn,
//   //   reserve1,
//   //   reserve0,
//   //   reserve1Fic.sub(1).lt(0) ? reserve1Fic : reserve1Fic.sub(1),
//   //   reserve0Fic,
//   //   newPriceAverage1,
//   //   newPriceAverage0,
//   // );

//   return {
//     currency: token0,
//     amount: amountOut,
//     amountMax: amountOut, // TODO is it still useful ?
//     newRes0,
//     newRes1,
//     newRes0Fic,
//     newRes1Fic,
//     newPriceAverage0,
//     newPriceAverage1,
//     forcedPriceAverageTimestamp,
//   };
// }

// /**
//  * Computes the amount of tokenIn, at the precision of 1 wei.
//  * Use case: you want to receive exactly tokenOut amount and want to know the exact tokenIn amount to send.
//  * WARNING: token0 and token1 are pair tokens which addresses hexadecimal's values are sorted as token0 < token1.
//  * @param {string} token0 the currency address of token0.
//  * @param {string} token1 the currency address of token1.
//  * @param {BigNumber} reserve0 the reserves of token0.
//  * @param {BigNumber} reserve1 the reserves of token1.
//  * @param {BigNumber} reserve0Fic the fictionnal reserves of token0.
//  * @param {BigNumber} reserve1Fic the fictionnal reserves of token1.
//  * @param {BigNumber} tokenAmountOut the output amount of the trade.
//  * @param {BigNumber} tokenAddressOut address of the output token.
//  * @param {number} priceAverageLastTimestamp timestamp in seconds of latest price average.
//  * @param {BigNumber} priceAverage0 latest price average of token0.
//  * @param {BigNumber} priceAverage1 latest price average of token1.
//  * @param {number} forcedPriceAverageTimestamp current timestamp or timestamp of the trade in seconds.
//  * @returns {Object} { currency, amount, amountMax, newResIn, newResOut, newResInFic, newResOutFic }
//  */
// export function computeAmountIn(
//   token0: string,
//   token1: string,
//   reserve0: BigNumber,
//   reserve1: BigNumber,
//   reserve0Fic: BigNumber,
//   reserve1Fic: BigNumber,
//   tokenAmountOut: BigNumber,
//   tokenAddressOut: string,
//   priceAverageLastTimestamp: number,
//   priceAverage0: BigNumber,
//   priceAverage1: BigNumber,
//   forcedPriceAverageTimestamp: number = Math.ceil(Date.now() / 1000) +
//     LATENCY_OFFSET_SECONDS,
// ): CurrencyAmount {
//   if (tokenAddressOut === token0) {
//     const [newPriceAverage1, newPriceAverage0] = getUpdatedPriceAverage(
//       reserve1Fic,
//       reserve0Fic,
//       priceAverageLastTimestamp,
//       priceAverage1,
//       priceAverage0,
//       forcedPriceAverageTimestamp,
//     );

//     const [amountIn, newRes1, newRes0, newRes1Fic, newRes0Fic] = getAmountIn(
//       tokenAmountOut,
//       reserve1,
//       reserve0,
//       reserve1Fic,
//       reserve0Fic,
//       newPriceAverage1,
//       newPriceAverage0,
//     );
//     // const [amountMax] = getAmountIn(
//     //   tokenAmountOut,
//     //   reserve1,
//     //   reserve0,
//     //   reserve1Fic,
//     //   reserve0Fic.sub(1).lt(0) ? reserve0Fic : reserve0Fic.sub(1),
//     //   newPriceAverage1,
//     //   newPriceAverage0,
//     // );

//     return {
//       currency: token1,
//       amount: amountIn,
//       amountMax: amountIn, // TODO is it still useful ?
//       newRes0,
//       newRes1,
//       newRes0Fic,
//       newRes1Fic,
//       newPriceAverage0,
//       newPriceAverage1,
//     };
//   }

//   // token1 is tokenOut
//   const [newPriceAverage0, newPriceAverage1] = getUpdatedPriceAverage(
//     reserve0Fic,
//     reserve1Fic,
//     priceAverageLastTimestamp,
//     priceAverage0,
//     priceAverage1,
//     forcedPriceAverageTimestamp,
//   );

//   const [amountIn, newRes0, newRes1, newRes0Fic, newRes1Fic] = getAmountIn(
//     tokenAmountOut,
//     reserve0,
//     reserve1,
//     reserve0Fic,
//     reserve1Fic,
//     newPriceAverage0,
//     newPriceAverage1,
//   );

//   // const [amountMax] = getAmountIn(
//   //   tokenAmountOut,
//   //   reserve0,
//   //   reserve1,
//   //   reserve0Fic,
//   //   reserve1Fic.sub(1).lt(0) ? reserve1Fic : reserve1Fic.sub(1),
//   //   newPriceAverage0,
//   //   newPriceAverage1,
//   // );

//   return {
//     currency: token0,
//     amount: amountIn,
//     amountMax: amountIn, // TODO is it still useful ?
//     newRes0,
//     newRes1,
//     newRes0Fic,
//     newRes1Fic,
//     newPriceAverage0,
//     newPriceAverage1,
//     forcedPriceAverageTimestamp,
//   };
// }

/**
 * Computes price impact
 * you can manually verify the values using https://www.calculatorsoup.com/calculators/algebra/percent-change-calculator.php
 * @param {string[]} path array of token addresses composing the trade (reverse order for EXACT_OUTPUT).
 * @param {Pair[]} pairs array of pairs composing the trade (reverse order for EXACT_OUTPUT).
 * @param {BigNumber} inputAmount the input amount of the trade.
 * @param {BigNumber} outputAmount the output amount of the trade, calculated with computeAmountOut.
 * @returns {BigNumber} the percent change (not difference) between the mid price and the execution price, i.e. price impact.
 */
export function computePriceImpact(
  path: string[],
  pairs: Pair[],
  inputAmount: BigNumber,
  outputAmount: BigNumber,
): BigNumber {
  // Intermediate results are not exact relative to tokens decimals but the returned result is independant of decimals differences
  let initalPrice = utils.parseEther('1');
  const midPrice = priceRatio(outputAmount, inputAmount);

  // returns 100% price impact
  if (midPrice.lte(0)) return utils.parseEther('1');

  for (let i = 0; i < pairs.length; i += 1) {
    if (
      !pairs[i].prevReserveFic1 ||
      !pairs[i].prevReserveFic0 ||
      pairs[i].prevReserveFic1?.eq(0) ||
      pairs[i].prevReserveFic0?.eq(0)
    ) {
      return utils.parseEther('1');
    }

    const refIsToken0 = path[i] === pairs[i].token0;
    initalPrice = initalPrice
      .mul(refIsToken0 ? pairs[i].prevReserveFic1! : pairs[i].prevReserveFic0!)
      .div(refIsToken0 ? pairs[i].prevReserveFic0! : pairs[i].prevReserveFic1!);
  }
  return priceRatio(initalPrice.sub(midPrice).abs(), initalPrice);
}

/**
 * Comparator function to sort best trades
 * Trades are sorted by their output amounts in decreasing order, first
 * Then they are sorted by their input amounts in increasing order
 * i.e. the best trades have the most outputs for the least inputs and are sorted first.
 * @param {CurrencyAmount} inputA trade A input amount.
 * @param {CurrencyAmount} outputA trade B input amount.
 * @param {CurrencyAmount} inputB trade A input amount.
 * @param {CurrencyAmount} outputB trade A input amount.
 * @return {number} 1 when 'trade B' is better than 'trade A', -1 when 'trade A' is better than 'B', 0 when trades are equal.
 */
export function inputOutputComparator(
  inputA: CurrencyAmount,
  outputA: CurrencyAmount,
  inputB: CurrencyAmount,
  outputB: CurrencyAmount,
): number {
  // must have same input and output token for comparison
  if (inputA.currency !== inputB.currency) throw new Error('INPUT_CURRENCY');
  if (outputA.currency !== outputB.currency) throw new Error('OUTPUT_CURRENCY');
  if (outputA.amount.eq(outputB.amount)) {
    if (inputA.amount.eq(inputB.amount)) {
      return 0;
    }
    // trade A requires less input than trade B, so A should come first
    if (inputA.amount.lt(inputB.amount)) {
      return -1;
    }
    return 1;
  }
  // tradeA has less output than trade B, so should come second
  if (outputA.amount.lt(outputB.amount)) {
    return 1;
  }
  return -1;
}

/**
 * Compares trades extending inputOutputComparator ranking with price impact and path length
 * @param {Trade} a trade A to compare
 * @param {Trade} b trade B to compare
 * @return {number} 1 when 'b' is better than 'a', -1 when 'a' is better than 'b', 0 when trades are equal
 */
export function tradeComparator(a: Trade, b: Trade): number {
  const ioComp = inputOutputComparator(
    a.amountIn,
    a.amountOut,
    b.amountIn,
    b.amountOut,
  );
  if (ioComp !== 0) {
    return ioComp;
  }

  // consider lowest priceImpact next, since these are less likely to fail
  if (a.priceImpact!.lt(b.priceImpact!)) {
    return -1;
  }
  if (a.priceImpact!.gt(b.priceImpact!)) {
    return 1;
  }

  // finally consider the number of hops since each hop costs gas
  return a.route.path.length - b.route.path.length;
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

// // Computes the best trade for the exact amount in, function is used internally with recursion
// // extended parameters includes 'tradeTimestamp' which represents the current timestamp in seconds
// // other parameters are used by the function internally in for recursion loop
// function bestTradeExactInInternal(
//   pairs: Pair[],
//   currencyAmountIn: CurrencyAmount,
//   currencyOut: string,
//   tradeTimestamp: number,
//   { maxNumResults = 3, maxHops = 3, arbitrage = false }: BestTradeOptions = {},
//   // used in recursion.
//   currentPairs: Pair[] = [],
//   nextAmountIn: CurrencyAmount = currencyAmountIn,
//   bestTrades: Trade[] = [],
// ): Trade[] {
//   if (pairs.length <= 0) throw new Error('PAIRS');
//   if (maxHops <= 0) throw new Error('MAX_HOPS');
//   if (
//     currencyAmountIn.currency !== nextAmountIn.currency &&
//     currentPairs.length <= 0
//   )
//     throw new Error('INVALID_RECURSION');

//   for (let i = 0; i < pairs.length; i += 1) {
//     const pair = { ...pairs[i] };

//     // pair irrelevant
//     if (
//       pair.token0 !== nextAmountIn.currency &&
//       pair.token1 !== nextAmountIn.currency
//     )
//       continue;
//     if (pair.reserve0.eq(0) || pair.reserve1.eq(0)) continue;
//     if (pair.reserve0LastFictive.eq(0) || pair.reserve1LastFictive.eq(0))
//       continue;

//     // breaks arbitrage loops in case config disabled such behaviour
//     const path = getPathFromInput(
//       [...currentPairs, pair],
//       currencyAmountIn.currency,
//     );
//     if (
//       !arbitrage &&
//       path.find((token, arrayIndex) => arrayIndex !== path.indexOf(token))
//     )
//       continue;

//     let amountOutData: CurrencyAmount;
//     try {
//       amountOutData = computeAmountOut(
//         pair.token0,
//         pair.token1,
//         pair.reserve0,
//         pair.reserve1,
//         pair.reserve0LastFictive,
//         pair.reserve1LastFictive,
//         nextAmountIn.amount,
//         nextAmountIn.currency,
//         pair.priceAverageLastTimestamp,
//         pair.priceAverage0,
//         pair.priceAverage1,
//         pair?.forcedPriceAverageTimestamp,
//       );
//       // Update pair's info
//       pair.reserve0 = amountOutData.newRes0 || pair.reserve0;
//       pair.reserve1 = amountOutData.newRes1 || pair.reserve1;
//       pair.prevReserveFic0 = pair.reserve0LastFictive;
//       pair.prevReserveFic1 = pair.reserve1LastFictive;
//       pair.reserve0LastFictive =
//         amountOutData.newRes0Fic || pair.reserve0LastFictive;
//       pair.reserve1LastFictive =
//         amountOutData.newRes1Fic || pair.reserve1LastFictive;
//       pair.priceAverage0 = amountOutData.newPriceAverage0 || pair.priceAverage0;
//       pair.priceAverage1 = amountOutData.newPriceAverage1 || pair.priceAverage1;
//       pair.forcedPriceAverageTimestamp =
//         amountOutData?.forcedPriceAverageTimestamp || tradeTimestamp;
//     } catch (error: any) {
//       if (error.name === 'SmarDexSDK') {
//         continue;
//       }
//       throw error;
//     }

//     const selectedPairs = [...currentPairs, pair];

//     // we have arrived at the output token, so this is the final trade of one of the paths
//     if (amountOutData.currency === currencyOut) {
//       sortedInsert(
//         bestTrades,
//         {
//           route: {
//             pairs: selectedPairs,
//             path,
//             input: currencyAmountIn.currency,
//             output: currencyOut,
//           },
//           amountIn: currencyAmountIn,
//           amountOut: amountOutData,
//           tradeType: TradeType.EXACT_INPUT,
//           priceImpact: computePriceImpact(
//             path,
//             selectedPairs,
//             currencyAmountIn.amount,
//             amountOutData.amount,
//           ),
//         },
//         maxNumResults,
//         tradeComparator,
//       );
//     } else if (maxHops > 1 && pairs.length > 1) {
//       const pairsExcludingThisPair = pairs.filter((_, index) => index !== i);

//       // otherwise, consider all the other paths that lead from this token as long as we have not exceeded maxHops
//       bestTradeExactInInternal(
//         pairsExcludingThisPair,
//         currencyAmountIn,
//         currencyOut,
//         tradeTimestamp,
//         {
//           maxNumResults,
//           maxHops: maxHops - 1,
//           arbitrage,
//         },
//         selectedPairs,
//         amountOutData,
//         bestTrades,
//       );
//     }
//   }
//   return bestTrades;
// }

// /**
//  * Given a list of pairs, and a fixed amount in, returns the top `maxNumResults` trades that go from an input token
//  * amount to an output token, making at most `maxHops` hops.
//  * Note this does not consider aggregation, as routes are linear. It's possible a better route exists by splitting
//  * the amount in among multiple routes.
//  * @param {Pair[]} pairs the pairs to consider in finding the best trade.
//  * @param {CurrencyAmount} currencyAmountIn provided currency with exact amount of input provided for thetrade.
//  * @param {string} currencyOut address of the desired currency requested in output.
//  * @param {Object} [option={maxNumResults=3,maxHops=3,arbitrage=false}] additional options, including:
//  * @param {number} option.maxNumResults maximum number of trade results to return.
//  * @param {number} option.maxHops maximum number of hops per individual trade, e.g. 1 hop goes through a single pair.
//  * @param {boolean} option.arbitrage to enable arbitrage loops in the returned trades (i.e. route can pass multiple times by the same token).
//  * @returns {Trade[]} Array of trades ordered by best trade first.
//  */
// export function bestTradeExactIn(
//   pairs: Pair[],
//   currencyAmountIn: CurrencyAmount,
//   currencyOut: string,
//   { maxNumResults = 3, maxHops = 3, arbitrage = false }: BestTradeOptions = {},
// ) {
//   return bestTradeExactInInternal(
//     pairs,
//     currencyAmountIn,
//     currencyOut,
//     Math.ceil(Date.now() / 1000) + LATENCY_OFFSET_SECONDS,
//     {
//       maxNumResults,
//       maxHops,
//       arbitrage,
//     },
//   );
// }

// // Computes the best trade for the exact amount out, function is used internally with recursion
// // extended parameters includes 'tradeTimestamp' which represents the current timestamp in seconds
// // other parameters are used by the function internally in for recursion loop
// function bestTradeExactOutInternal(
//   pairs: Pair[],
//   currencyIn: string,
//   currencyAmountOut: CurrencyAmount,
//   tradeTimestamp: number,
//   { maxNumResults = 3, maxHops = 3, arbitrage = false }: BestTradeOptions = {},
//   // used in recursion.
//   currentPairs: Pair[] = [],
//   nextAmountOut: CurrencyAmount = currencyAmountOut,
//   bestTrades: Trade[] = [],
// ): Trade[] {
//   if (pairs.length <= 0) throw new Error('PAIRS');
//   if (maxHops <= 0) throw new Error('MAX_HOPS');
//   if (
//     currencyAmountOut.currency !== nextAmountOut.currency &&
//     currentPairs.length <= 0
//   )
//     throw new Error('INVALID_RECURSION');

//   for (let i = 0; i < pairs.length; i += 1) {
//     const pair = { ...pairs[i] };

//     // pair irrelevant
//     if (
//       pair.token0 !== nextAmountOut.currency &&
//       pair.token1 !== nextAmountOut.currency
//     )
//       continue;
//     if (pair.reserve0.eq(0) || pair.reserve1.eq(0)) continue;
//     if (pair.reserve0LastFictive.eq(0) || pair.reserve1LastFictive.eq(0))
//       continue;

//     // breaks arbitrage loops in case config disabled such behaviour
//     const path = getPathFromOutput(
//       [pair, ...currentPairs],
//       currencyAmountOut.currency,
//     );
//     if (
//       !arbitrage &&
//       path.find((token, arrayIndex) => arrayIndex !== path.indexOf(token))
//     )
//       continue;

//     let amountInData: CurrencyAmount;
//     try {
//       amountInData = computeAmountIn(
//         pair.token0,
//         pair.token1,
//         pair.reserve0,
//         pair.reserve1,
//         pair.reserve0LastFictive,
//         pair.reserve1LastFictive,
//         nextAmountOut.amount,
//         nextAmountOut.currency,
//         pair.priceAverageLastTimestamp,
//         pair.priceAverage0,
//         pair.priceAverage1,
//         pair?.forcedPriceAverageTimestamp,
//       );
//       // Update pair's info
//       pair.reserve0 = amountInData.newRes0 || pair.reserve0;
//       pair.reserve1 = amountInData.newRes1 || pair.reserve1;
//       pair.prevReserveFic0 = pair.reserve0LastFictive;
//       pair.prevReserveFic1 = pair.reserve1LastFictive;
//       pair.reserve0LastFictive =
//         amountInData.newRes0Fic || pair.reserve0LastFictive;
//       pair.reserve1LastFictive =
//         amountInData.newRes1Fic || pair.reserve1LastFictive;
//       pair.priceAverage0 = amountInData.newPriceAverage0 || pair.priceAverage0;
//       pair.priceAverage1 = amountInData.newPriceAverage1 || pair.priceAverage1;
//       pair.forcedPriceAverageTimestamp =
//         amountInData?.forcedPriceAverageTimestamp || tradeTimestamp;
//     } catch (error: any) {
//       if (error.name === 'SmarDexSDK') {
//         continue;
//       }
//       throw error;
//     }

//     const selectedPairs = [pair, ...currentPairs];

//     // we have arrived at the input token, so this is the final trade of one of the paths
//     if (amountInData.currency === currencyIn) {
//       sortedInsert(
//         bestTrades,
//         {
//           route: {
//             pairs: selectedPairs,
//             path,
//             input: currencyIn,
//             output: currencyAmountOut.currency,
//           },
//           amountIn: amountInData,
//           amountOut: currencyAmountOut,
//           tradeType: TradeType.EXACT_OUTPUT,
//           priceImpact: computePriceImpact(
//             path,
//             selectedPairs,
//             amountInData.amount,
//             currencyAmountOut.amount,
//           ),
//         },
//         maxNumResults,
//         tradeComparator,
//       );
//     } else if (maxHops > 1 && pairs.length > 1) {
//       const pairsExcludingThisPair = pairs.filter((_, index) => index !== i);

//       // otherwise, consider all the other paths that lead from this token as long as we have not exceeded maxHops
//       bestTradeExactOutInternal(
//         pairsExcludingThisPair,
//         currencyIn,
//         currencyAmountOut,
//         tradeTimestamp,
//         {
//           maxNumResults,
//           maxHops: maxHops - 1,
//           arbitrage,
//         },
//         selectedPairs,
//         amountInData,
//         bestTrades,
//       );
//     }
//   }
//   return bestTrades;
// }

// /**
//  * Given a list of pairs, and a fixed amount in, returns the top `maxNumResults` trades that go from an input token
//  * amount to an output token, making at most `maxHops` hops.
//  * Note this does not consider aggregation, as routes are linear. It's possible a better route exists by splitting
//  * the amount in among multiple routes.
//  * @param {Pair[]} pairs the pairs to consider in finding the best trade.
//  * @param {string} currencyIn address of the desired currency requested in input.
//  * @param {CurrencyAmount} currencyAmountOut currency with exact amount of output provided for thetrade.
//  * @param {Object} [option={maxNumResults=3,maxHops=3,arbitrage=false}] additional options, including:
//  * @param {number} option.maxNumResults maximum number of trade results to return.
//  * @param {number} option.maxHops maximum number of hops per individual trade, e.g. 1 hop goes through a single pair.
//  * @param {boolean} option.arbitrage to enable arbitrage loops in the returned trades (i.e. route can pass multiple times by the same token).
//  * @returns {Trade[]} Array of trades ordered by best trade first.
//  */
// export function bestTradeExactOut(
//   pairs: Pair[],
//   currencyIn: string,
//   currencyAmountOut: CurrencyAmount,
//   { maxNumResults = 3, maxHops = 3, arbitrage = false }: BestTradeOptions = {},
// ) {
//   return bestTradeExactOutInternal(
//     pairs,
//     currencyIn,
//     currencyAmountOut,
//     Math.ceil(Date.now() / 1000) + LATENCY_OFFSET_SECONDS,
//     {
//       maxNumResults,
//       maxHops,
//       arbitrage,
//     },
//   );
// }

// constants to compute approximate equality
const APPROX_EQ_PRECISION: BigNumber = BigNumber.from(1);
const APPROX_EQ_BASE_PRECISION: BigNumber = BigNumber.from(1000000);

/**
 * Computes logarithm in base 2 for a given positive number. Result is rounded down
 *
 * @param {BigNumber} value - value to compute the log2
 * @returns {BigNumber} the log in base 2 of the value, 0 if given 0.
 */
export function log2(value: BigNumber): BigNumber {
  let result = constants.Zero;
  if (value.shr(128).gt(0)) {
    // eslint-disable-next-line no-param-reassign
    value = value.shr(128);
    result = result.add(128);
  }
  if (value.shr(64).gt(0)) {
    // eslint-disable-next-line no-param-reassign
    value = value.shr(64);
    result = result.add(64);
  }
  if (value.shr(32).gt(0)) {
    // eslint-disable-next-line no-param-reassign
    value = value.shr(32);
    result = result.add(32);
  }
  if (value.shr(16).gt(0)) {
    // eslint-disable-next-line no-param-reassign
    value = value.shr(16);
    result = result.add(16);
  }
  if (value.shr(8).gt(0)) {
    // eslint-disable-next-line no-param-reassign
    value = value.shr(8);
    result = result.add(8);
  }
  if (value.shr(4).gt(0)) {
    // eslint-disable-next-line no-param-reassign
    value = value.shr(4);
    result = result.add(4);
  }
  if (value.shr(2).gt(0)) {
    // eslint-disable-next-line no-param-reassign
    value = value.shr(2);
    result = result.add(2);
  }
  if (value.shr(1).gt(0)) {
    result = result.add(1);
  }
  return result;
}

/**
 * Computes the square root of a number. If the number is not a perfect square, the value is rounded down.
 * Inspired by Henry S. Warren, Jr.'s "Hacker's Delight" (Chapter 11).
 *
 * @param {BigNumber} value - value to compute the square root
 * @returns {BigNumber} the square root of the value
 */
export function sqrt(a: BigNumber): BigNumber {
  if (a.eq(constants.Zero)) {
    return constants.Zero;
  }

  // For our first guess, we get the biggest power of 2 which is smaller than the square root of the target.
  //
  // We know that the "msb" (most significant bit) of our target number `a` is a power of 2 such that we have
  // `msb(a) <= a < 2*msb(a)`. This value can be written `msb(a)=2**k` with `k=log2(a)`.
  //
  // This can be rewritten `2**log2(a) <= a < 2**(log2(a) + 1)`
  // → `sqrt(2**k) <= sqrt(a) < sqrt(2**(k+1))`
  // → `2**(k/2) <= sqrt(a) < 2**((k+1)/2) <= 2**(k/2 + 1)`
  //
  // Consequently, `2**(log2(a) / 2)` is a good first approximation of `sqrt(a)` with at least 1 correct bit.
  let result = constants.One.shl(log2(a).div(2).toNumber());

  // At this point `result` is an estimation with one bit of precision. We know the true value is a uint128,
  // since it is the square root of a uint256. Newton's method converges quadratically (precision doubles at
  // every iteration). We thus need at most 7 iteration to turn our partial result with one bit of precision
  // into the expected uint128 result.
  result = result.add(a.div(result)).shr(1);
  result = result.add(a.div(result)).shr(1);
  result = result.add(a.div(result)).shr(1);
  result = result.add(a.div(result)).shr(1);
  result = result.add(a.div(result)).shr(1);
  result = result.add(a.div(result)).shr(1);
  result = result.add(a.div(result)).shr(1);
  return result.lt(a.div(result)) ? result : a.div(result);
}

/**
 * Evaluates the equality of two numbers at a precision of 1/1_000_000
 *
 * @param {BigNumber} x - value to compare
 * @param {BigNumber} y - value to compare
 * @returns {boolean} true if numbers are approximatively equal at 1/1_000_000, false otherwise
 */
export function approxEq(x: BigNumber, y: BigNumber): true | false {
  return x.gt(y)
    ? x.lt(y.add(y.mul(APPROX_EQ_PRECISION).div(APPROX_EQ_BASE_PRECISION)))
    : y.lt(x.add(x.mul(APPROX_EQ_PRECISION).div(APPROX_EQ_BASE_PRECISION)));
}

/**
 * Evaluates the equality of two ratio numbers at a precision of 1/1_000_000. xNum / xDen ~= yNum / yDen
 *
 * @param {BigNumber} _xNum - first number numerator
 * @param {BigNumber} _xDen - first number denominator
 * @param {BigNumber} _yNum - second number numerator
 * @param {BigNumber} _yDen - second number denominator
 * @returns {boolean} true if the two ratios are approximatively equal at 1/1_000_000, false otherwise
 */
export function ratioApproxEq(
  _xNum: BigNumber,
  _xDen: BigNumber,
  _yNum: BigNumber,
  _yDen: BigNumber,
): true | false {
  return approxEq(_xNum.mul(_yDen), _xDen.mul(_yNum));
}

/**
 * Computes the ratio of two numbers
 *
 * @param {BigNumber} numerator - numerator number
 * @param {BigNumber} denominator - denominator number
 * @returns {BigNumber} ratio of the two numbers. returns 0 if denominator is 0
 */
export function priceRatio(numerator: BigNumber, denominator: BigNumber) {
  if (denominator.eq(0)) return BigNumber.from(0);
  return utils.parseEther(numerator.toString()).div(denominator);
}

/**
 * Given an array of items sorted by `comparator` function, insert an item into its sort index and constrain
 * the size to `maxSize` by removing the last item
 * WARNING: This function mutates the input array !
 * Inspired by Uniswap V2: https://github.com/Uniswap/sdk-core/blob/main/src/utils/sortedInsert.ts
 *
 * @param {T[]} items - array of items to insert result into
 * @param {T} add - item to insert
 * @param {number} maxSize - maximum size of the desired array
 * @param {(a: T, b: T) => number} comparator - comparator function to sort the array
 * @returns {T | null} the item which was removed from the array, or null if no item was removed
 */
export function sortedInsert<T>(
  items: T[],
  add: T,
  maxSize: number,
  comparator: (a: T, b: T) => number,
): T | null {
  if (maxSize <= 0) throw new Error('MAX_SIZE_ZERO');
  // this is an invariant because the interface cannot return multiple removed items if items.length exceeds maxSize
  if (items.length > maxSize) throw new Error('ITEMS_SIZE');

  // short circuit first item add
  if (items.length === 0) {
    items.push(add);
    return null;
  }

  const isFull = items.length === maxSize;
  // short circuit if full and the additional item does not come before the last item
  if (isFull && comparator(items[items.length - 1], add) <= 0) {
    return add;
  }

  let lo = 0;
  let hi = items.length;

  while (lo < hi) {
    // eslint-disable-next-line no-bitwise
    const mid = (lo + hi) >>> 1;
    if (comparator(items[mid], add) <= 0) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  items.splice(lo, 0, add);
  return isFull ? items.pop()! : null;
}
