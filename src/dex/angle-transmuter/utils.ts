import { BASE_12, BASE_9, Fees, MAX_BURN_FEE, QuoteType } from './types';

/// @notice Computes the `amountOut` of stablecoins to mint from `tokenIn` of a collateral with data `collatInfo`
export function _quoteMintExactInput(
  oracleValue: number,
  amountIn: number,
  fees: Fees,
  stablecoinsIssued: number,
  otherStablecoinSupply: number,
): number {
  const amountOut = oracleValue * amountIn;
  return _quoteFees(
    fees,
    QuoteType.MintExactInput,
    amountOut,
    stablecoinsIssued,
    otherStablecoinSupply,
  );
}

/// @notice Computes the `amountIn` of collateral to get during a mint of `amountOut` of stablecoins
export function _quoteMintExactOutput(
  oracleValue: number,
  amountOut: number,
  fees: Fees,
  stablecoinsIssued: number,
  otherStablecoinSupply: number,
): number {
  const amountIn = _quoteFees(
    fees,
    QuoteType.MintExactOutput,
    amountOut,
    stablecoinsIssued,
    otherStablecoinSupply,
  );
  return amountIn / oracleValue;
}

/// @notice Computes the `amountIn` of stablecoins to burn to release `amountOut` of `collateral`
export function _quoteBurnExactOutput(
  oracleValue: number,
  ratio: number,
  amountOut: number,
  fees: Fees,
  stablecoinsIssued: number,
  otherStablecoinSupply: number,
): number {
  const amountIn = (amountOut * oracleValue) / ratio;
  return _quoteFees(
    fees,
    QuoteType.BurnExactOutput,
    amountIn,
    stablecoinsIssued,
    otherStablecoinSupply,
  );
}

/// @notice Computes the `amountOut` of `collateral` to give during a burn operation of `amountIn` of stablecoins
export function _quoteBurnExactInput(
  oracleValue: number,
  ratio: number,
  amountIn: number,
  fees: Fees,
  stablecoinsIssued: number,
  otherStablecoinSupply: number,
): number {
  const amountOut = _quoteFees(
    fees,
    QuoteType.BurnExactInput,
    amountIn,
    stablecoinsIssued,
    otherStablecoinSupply,
  );
  return (amountOut * ratio) / oracleValue;
}

export function _quoteFees(
  fees: Fees,
  quoteType: QuoteType,
  amountStable: number,
  stablecoinsIssued: number,
  otherStablecoinSupply: number,
): number {
  const isMint = _isMint(quoteType);
  const isExact = _isExact(quoteType);

  const n = isMint ? fees.xFeeMint.length : fees.xFeeBurn.length;

  let currentExposure =
    (stablecoinsIssued * BASE_9) / (otherStablecoinSupply + stablecoinsIssued);

  let amount: number = 0;

  // Finding in which segment the current exposure to the collateral is
  let i = findLowerBound(
    isMint,
    isMint ? fees.xFeeMint : fees.xFeeBurn,
    BASE_9,
    currentExposure,
  );

  let lowerExposure: number;
  let upperExposure: number;
  let lowerFees: number;
  let upperFees: number;
  let amountToNextBreakPoint: number;

  while (i < n - 1) {
    // We compute a linear by part function on the amount swapped
    // The `amountToNextBreakPoint` variable is the `b_{i+1}` value from the whitepaper
    if (isMint) {
      lowerExposure = fees.xFeeMint[i];
      upperExposure = fees.xFeeMint[i + 1];
      lowerFees = fees.yFeeMint[i];
      upperFees = fees.yFeeMint[i + 1];
      amountToNextBreakPoint =
        (otherStablecoinSupply * upperExposure) / (BASE_9 - upperExposure) -
        stablecoinsIssued;
    } else {
      // The exposures in the burn case are decreasing
      lowerExposure = fees.xFeeBurn[i];
      upperExposure = fees.xFeeBurn[i + 1];
      lowerFees = fees.yFeeBurn[i];
      upperFees = fees.yFeeBurn[i + 1];
      // The `b_{i+1}` value in the burn case is the opposite value of the mint case
      amountToNextBreakPoint =
        stablecoinsIssued -
        (otherStablecoinSupply * upperExposure) / (BASE_9 - upperExposure);
    }

    let currentFees: number;
    if (lowerExposure * BASE_9 === currentExposure) {
      currentFees = lowerFees;
    } else if (lowerFees === upperFees) {
      currentFees = lowerFees;
    } else {
      // This is the opposite of the `b_i` value from the whitepaper.
      const amountFromPrevBreakPoint = isMint
        ? stablecoinsIssued -
          (otherStablecoinSupply * lowerExposure) / (BASE_9 - lowerExposure)
        : (otherStablecoinSupply * lowerExposure) / (BASE_9 - lowerExposure) -
          stablecoinsIssued;

      // slope = (upperFees - lowerFees) / (amountToNextBreakPoint + amountFromPrevBreakPoint)
      // `currentFees` is the `g(0)` value from the whitepaper
      currentFees =
        lowerFees +
        ((upperFees - lowerFees) * amountFromPrevBreakPoint) /
          (amountToNextBreakPoint + amountFromPrevBreakPoint);
    }
    {
      let amountToNextBreakPointNormalizer: number = isExact
        ? amountToNextBreakPoint
        : isMint
        ? _invertFeeMint(amountToNextBreakPoint, (upperFees + currentFees) / 2)
        : _applyFeeBurn(amountToNextBreakPoint, (upperFees + currentFees) / 2);

      if (amountToNextBreakPointNormalizer >= amountStable) {
        let midFee: number;
        if (isExact) {
          // `(g_i(0) + g_i(M)) / 2 = g(0) + (f_{i+1} - g(0)) * M / (2 * b_{i+1})`
          midFee =
            currentFees +
            (amountStable * (upperFees - currentFees)) /
              (2 * amountToNextBreakPointNormalizer);
        } else {
          // Here instead of computing the closed form expression for `m_t` derived in the whitepaper,
          // we are computing: `(g(0)+g_i(m_t))/2 = g(0)+(f_{i+1}-f_i)/(b_{i+1}-b_i)m_t/2

          // ac4 is the value of `2M(f_{i+1}-f_i)/(b_{i+1}-b_i) = 2M(f_{i+1}-g(0))/b_{i+1}` used
          // in the computation of `m_t` in both the mint and burn case
          const ac4 =
            (BASE_9 * (2 * amountStable * (upperFees - currentFees))) /
            amountToNextBreakPoint;
          if (isMint) {
            // In the mint case:
            // `m_t = (-1-g(0)+sqrt[(1+g(0))**2+2M(f_{i+1}-g(0))/b_{i+1})]/((f_{i+1}-g(0))/b_{i+1})`
            // And so: g(0)+(f_{i+1}-f_i)/(b_{i+1}-b_i)m_t/2
            //                      = (g(0)-1+sqrt[(1+g(0))**2+2M(f_{i+1}-g(0))/b_{i+1})])
            midFee = Number(
              (Math.sqrt((BASE_9 + currentFees) ** 2 + ac4) +
                currentFees -
                BASE_9) /
                2,
            );
          } else {
            // In the burn case:
            // `m_t = (1-g(0)+sqrt[(1-g(0))**2-2M(f_{i+1}-g(0))/b_{i+1})]/((f_{i+1}-g(0))/b_{i+1})`
            // And so: g(0)+(f_{i+1}-f_i)/(b_{i+1}-b_i)m_t/2
            //                      = (g(0)+1-sqrt[(1-g(0))**2-2M(f_{i+1}-g(0))/b_{i+1})])

            const baseMinusCurrentSquared = (BASE_9 - currentFees) ** 2;
            // Mathematically, this condition is always verified, but rounding errors may make this
            // mathematical invariant break, in which case we consider that the square root is null
            if (baseMinusCurrentSquared < ac4) {
              midFee = (currentFees + BASE_9) / 2;
            } else {
              midFee =
                (currentFees +
                  BASE_9 -
                  Math.sqrt(baseMinusCurrentSquared - ac4)) /
                2;
            }
          }
        }
        return amount + _computeFee(quoteType, amountStable, midFee);
      } else {
        amountStable -= amountToNextBreakPointNormalizer;
        amount += !isExact
          ? amountToNextBreakPoint
          : isMint
          ? _invertFeeMint(
              amountToNextBreakPoint,
              (upperFees + currentFees) / 2,
            )
          : _applyFeeBurn(
              amountToNextBreakPoint,
              (upperFees + currentFees) / 2,
            );
        currentExposure = upperExposure * BASE_9;
        ++i;
        // Update for the rest of the swaps the stablecoins issued from the asset
        stablecoinsIssued = isMint
          ? stablecoinsIssued + amountToNextBreakPoint
          : stablecoinsIssued - amountToNextBreakPoint;
      }
    }
  }

  return (
    amount +
    _computeFee(
      quoteType,
      amountStable,
      isMint ? fees.yFeeMint[n - 1] : fees.yFeeBurn[n - 1],
    )
  );
}

function findLowerBound(
  increasingArray: boolean,
  array: number[],
  normalizerArray: number,
  element: number,
): number {
  if (array.length === 0) {
    return 0;
  }
  let low = 1;
  let high = array.length;

  if (
    (increasingArray && array[high - 1] * normalizerArray <= element) ||
    (!increasingArray && array[high - 1] * normalizerArray >= element)
  ) {
    return high - 1;
  }

  while (low < high) {
    const mid = Math.floor((low + high) / 2);

    if (
      increasingArray
        ? array[mid] * normalizerArray > element
        : array[mid] * normalizerArray < element
    ) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }

  return low - 1;
}

function _isMint(quoteType: QuoteType): boolean {
  return (
    quoteType === QuoteType.MintExactInput ||
    quoteType === QuoteType.MintExactOutput
  );
}

function _isExact(quoteType: QuoteType): boolean {
  return (
    quoteType === QuoteType.MintExactOutput ||
    quoteType === QuoteType.BurnExactInput
  );
}

function _applyFeeMint(amountIn: number, fees: number): number {
  if (fees >= 0) {
    const castedFees = fees;
    // Consider that if fees are above `BASE_12` this is equivalent to infinite fees
    if (castedFees >= BASE_12) throw new Error('InvalidSwap');
    return (amountIn * BASE_9) / (BASE_9 + castedFees);
  } else {
    return (amountIn * BASE_9) / (BASE_9 - Math.abs(-fees));
  }
}

function _invertFeeMint(amountOut: number, fees: number): number {
  if (fees >= 0) {
    const castedFees = fees;
    // Consider that if fees are above `BASE_12` this is equivalent to infinite fees
    if (castedFees >= BASE_12) throw new Error('InvalidSwap');
    return (amountOut * (BASE_9 + castedFees)) / BASE_9;
  } else {
    return (amountOut * (BASE_9 - Math.abs(-fees))) / BASE_9;
  }
}

function _applyFeeBurn(amountIn: number, fees: number): number {
  if (fees >= 0) {
    const castedFees = fees;
    if (castedFees >= MAX_BURN_FEE) throw new Error('InvalidSwap');
    return ((BASE_9 - castedFees) * amountIn) / BASE_9;
  } else {
    return ((BASE_9 + Math.abs(-fees)) * amountIn) / BASE_9;
  }
}

function _invertFeeBurn(amountOut: number, fees: number): number {
  if (fees >= 0) {
    const castedFees = fees;
    if (castedFees >= MAX_BURN_FEE) throw new Error('InvalidSwap');
    return (amountOut * BASE_9) / (BASE_9 - castedFees);
  } else {
    return (amountOut * BASE_9) / (BASE_9 + Math.abs(-fees));
  }
}

function _computeFee(
  quoteType: QuoteType,
  amount: number,
  fees: number,
): number {
  if (quoteType === QuoteType.MintExactInput) {
    return _applyFeeMint(amount, fees);
  } else if (quoteType === QuoteType.MintExactOutput) {
    return _invertFeeMint(amount, fees);
  } else if (quoteType === QuoteType.BurnExactInput) {
    return _applyFeeBurn(amount, fees);
  } else {
    return _invertFeeBurn(amount, fees);
  }
}
