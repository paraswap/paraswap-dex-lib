import { Const } from './Const';
import { Num } from './Num';
import { LogExpMath } from './LogExpMath';
import * as Struct from './Struct';
import { GeometricBrownianMotion } from './GeometricBrownianMotion';
import { ChainLinkData } from '../types';

export class MathMMM {
  /**********************************************************************************************
    // calcSpotPrice                                                                             //
    // sP = spotPrice                                                                            //
    // bI = tokenBalanceIn                      ( bI * w0 )                                      //
    // bO = tokenBalanceOut         sP =  ------------------------                               //
    // wI = tokenWeightIn                 ( bO * wI ) * ( 1 - sF )                               //
    // wO = tokenWeightOut                                                                       //
    // sF = swapFee                                                                              //
    **********************************************************************************************/
  static calcSpotPrice(
    tokenBalanceIn: bigint,
    tokenWeightIn: bigint,
    tokenBalanceOut: bigint,
    tokenWeightOut: bigint,
    swapFee: bigint,
  ): bigint {
    let numer = Num.mul(tokenBalanceIn, tokenWeightOut);
    let denom = Num.mul(
      Num.mul(tokenBalanceOut, tokenWeightIn),
      Const.ONE - swapFee,
    );
    return Num.div(numer, denom);
  }

  /**********************************************************************************************
    // calcOutGivenIn                                                                            //
    // aO = tokenAmountOut                                                                       //
    // bO = tokenBalanceOut                                                                      //
    // bI = tokenBalanceIn              /      /            bI             \    (wI / wO) \      //
    // aI = tokenAmountIn    aO = bO * |  1 - | --------------------------  | ^            |     //
    // wI = tokenWeightIn               \      \ ( bI + ( aI * ( 1 - sF )) /              /      //
    // wO = tokenWeightOut                                                                       //
    // sF = swapFee                                                                              //
    **********************************************************************************************/
  static calcOutGivenIn(
    tokenBalanceIn: bigint,
    tokenWeightIn: bigint,
    tokenBalanceOut: bigint,
    tokenWeightOut: bigint,
    tokenAmountIn: bigint,
    swapFee: bigint,
  ): bigint {
    const weightRatio = Num.div(tokenWeightIn, tokenWeightOut);
    let adjustedIn = Const.ONE - swapFee;
    adjustedIn = Num.mul(tokenAmountIn, adjustedIn);
    const y = Num.div(tokenBalanceIn, tokenBalanceIn + adjustedIn);
    const foo = Num.pow(y, weightRatio);
    const bar = Const.ONE - foo;
    const tokenAmountOut = Num.mul(tokenBalanceOut, bar);
    return tokenAmountOut;
  }

  /**********************************************************************************************
    // calcInGivenOut                                                                            //
    // aI = tokenAmountIn                                                                        //
    // bO = tokenBalanceOut               /  /     bO      \    (wO / wI)      \                 //
    // bI = tokenBalanceIn          bI * |  | ------------  | ^            - 1  |                //
    // aO = tokenAmountOut    aI =        \  \ ( bO - aO ) /                   /                 //
    // wI = tokenWeightIn           --------------------------------------------                 //
    // wO = tokenWeightOut                          ( 1 - sF )                                   //
    // sF = swapFee                                                                              //
    **********************************************************************************************/
  static calcInGivenOut(
    tokenBalanceIn: bigint,
    tokenWeightIn: bigint,
    tokenBalanceOut: bigint,
    tokenWeightOut: bigint,
    tokenAmountOut: bigint,
    swapFee: bigint,
  ): bigint {
    const weightRatio = Num.div(tokenWeightOut, tokenWeightIn);
    const diff = tokenBalanceOut - tokenAmountOut;
    const y = Num.div(tokenBalanceOut, diff);
    let foo = Num.pow(y, weightRatio);
    foo = foo - Const.ONE;
    let tokenAmountIn = Const.ONE - swapFee;
    tokenAmountIn = Num.div(Num.mul(tokenBalanceIn, foo), tokenAmountIn);
    return tokenAmountIn;
  }

  /**
   * @notice Computes the amount of tokenIn needed in order to receive a given amount of tokenOut
   * @dev A spread is applied as soon as entering a "shortage of tokenOut" phase
   * cf whitepaper: https://www.swaap.finance/whitepaper.pdf
   * @param tokenGlobalIn The pool global information on tokenIn
   * @param tokenGlobalOut The pool global information on tokenOut
   * @param relativePrice The price of tokenOut in tokenIn terms
   * @param swapParameters Amount of token out and swap fee
   * @param gbmParameters The GBM forecast parameters (Z, horizon)
   * @param hpParameters The parameters for historical prices retrieval
   * @return swapResult The swap result (amount in, spread and tax base in)
   */
  static calcInGivenOutMMM(
    tokenGlobalIn: Struct.TokenGlobal,
    tokenGlobalOut: Struct.TokenGlobal,
    relativePrice: bigint,
    swapParameters: Struct.SwapParameters,
    gbmParameters: Struct.GBMParameters,
    hpParameters: Struct.HistoricalPricesParameters,
    historicalPricesIn: ChainLinkData,
    historicalPricesOut: ChainLinkData,
    currentTimestamp: bigint,
  ): Struct.SwapResult {
    // determines the balance of tokenOut at equilibrium (cf definitions)
    const balanceOutAtEquilibrium = MathMMM.getTokenBalanceAtEquilibrium(
      tokenGlobalOut.info.balance,
      tokenGlobalOut.info.weight,
      tokenGlobalIn.info.balance,
      tokenGlobalIn.info.weight,
      Num.div(Const.ONE, relativePrice),
    );

    // from abundance of tokenOut to abundance of tokenOut --> no spread
    if (
      tokenGlobalOut.info.balance > balanceOutAtEquilibrium &&
      swapParameters.amount <
        tokenGlobalOut.info.balance - balanceOutAtEquilibrium
    ) {
      return {
        amount: MathMMM._calcInGivenOutMMMAbundance(
          tokenGlobalIn,
          tokenGlobalOut,
          // relativePrice,
          swapParameters.amount,
          swapParameters.fee,
          // swapParameters.fallbackSpread,
          // currentTimestamp,
        ),
        spread: 0n,
        taxBaseIn: 0n,
      };
    }

    {
      const gbmEstimation = GeometricBrownianMotion.getParametersEstimation(
        tokenGlobalIn.latestRound,
        tokenGlobalOut.latestRound,
        hpParameters,
        historicalPricesIn,
        historicalPricesOut,
      );

      const [adjustedTokenOutWeight, spread] = MathMMM.getMMMWeight(
        true,
        swapParameters.fallbackSpread,
        tokenGlobalOut.info.weight,
        gbmEstimation,
        gbmParameters,
      );

      if (tokenGlobalOut.info.balance <= balanceOutAtEquilibrium) {
        // shortage to shortage
        return {
          amount: MathMMM.calcInGivenOut(
            tokenGlobalIn.info.balance,
            tokenGlobalIn.info.weight,
            tokenGlobalOut.info.balance,
            adjustedTokenOutWeight,
            swapParameters.amount,
            swapParameters.fee,
          ),
          spread: spread,
          taxBaseIn: swapParameters.amount,
        };
      } else {
        // abundance to shortage
        const [amount, taxBaseIn] = MathMMM._calcInGivenOutMMMMixed(
          tokenGlobalIn,
          tokenGlobalOut,
          swapParameters,
          relativePrice,
          adjustedTokenOutWeight,
          balanceOutAtEquilibrium,
          currentTimestamp,
        );
        return {
          amount: amount,
          spread: spread,
          taxBaseIn: taxBaseIn,
        };
      }
    }
  }

  /**
   * @notice Implements 'calcInGivenOutMMM' in the case of abundance of tokenOut
   * @dev Two cases to consider:
   * 1) amount of tokenIn won't drive the pool from abundance of tokenOut to shortage ==> 1 pricing (no spread)
   * 2) amount of tokenIn will drive the pool from abundance of tokenOut to shortage ==> 2 pricing, one for each phase
   * @param tokenGlobalIn The pool global information on tokenIn
   * @param tokenGlobalOut The pool global information on tokenOut
   * @param swapParameters The parameters of the swap
   * @param relativePrice The price of tokenOut in tokenIn terms
   * @param adjustedTokenWeightOut The spread-augmented tokenOut's weight
   * @return tokenAmountIn The total amount of tokenIn needed for the swap
   * @return taxBaseIn The amount of tokenIn swapped when in shortage of tokenOut
   */
  static _calcInGivenOutMMMMixed(
    tokenGlobalIn: Struct.TokenGlobal,
    tokenGlobalOut: Struct.TokenGlobal,
    swapParameters: Struct.SwapParameters,
    relativePrice: bigint,
    adjustedTokenWeightOut: bigint,
    balanceOutAtEquilibrium: bigint,
    currentTimestamp: bigint,
  ): [bigint, bigint] {
    const tokenOutBuyAmountForEquilibrium =
      tokenGlobalOut.info.balance - balanceOutAtEquilibrium;

    // 'abundance of tokenOut' phase --> no spread
    const tokenAmountInPart1 = MathMMM._calcInGivenOutMMMAbundance(
      tokenGlobalIn,
      tokenGlobalOut,
      // relativePrice,
      tokenOutBuyAmountForEquilibrium,
      swapParameters.fee,
      // swapParameters.fallbackSpread,
      //currentTimestamp,
    );

    // 'shortage of tokenOut phase' --> apply spread
    const tokenAmountInPart2 = MathMMM.calcInGivenOut(
      tokenGlobalIn.info.balance + tokenAmountInPart1,
      tokenGlobalIn.info.weight,
      tokenGlobalOut.info.balance - tokenOutBuyAmountForEquilibrium,
      adjustedTokenWeightOut,
      swapParameters.amount - tokenOutBuyAmountForEquilibrium, // tokenAmountOut > tokenOutBuyAmountForEquilibrium
      swapParameters.fee,
    );

    return [
      Num.add(tokenAmountInPart1, tokenAmountInPart2),
      tokenAmountInPart2,
    ];
  }

  /**
   * @notice Implements calcOutGivenInMMM in the case of abundance of tokenOut
   * @dev A spread is applied as soon as entering a "shortage of tokenOut" phase
   * cf whitepaper: https://www.swaap.finance/whitepaper.pdf
   * @param tokenGlobalIn The pool global information on tokenIn
   * @param tokenGlobalOut The pool global information on tokenOut
   * @param relativePrice The price of tokenOut in tokenIn terms
   * @param tokenAmountOut The amount of tokenOut that will be received
   * @param baseFee The base fee
   * @param fallbackSpread The default spread in case the it couldn't be calculated using oracle prices
   * @return tokenAmountIn The amount of tokenIn needed for the swap
   */
  static _calcInGivenOutMMMAbundance(
    tokenGlobalIn: Struct.TokenGlobal,
    tokenGlobalOut: Struct.TokenGlobal,
    // relativePrice: bigint,
    tokenAmountOut: bigint,
    baseFee: bigint,
    // fallbackSpread: bigint,
    // currentTimestamp: bigint,
  ): bigint {
    const adaptiveFees = baseFee; /*MathMMM.getAdaptiveFees(
      tokenGlobalIn,
      Num.mul(tokenAmountOut, relativePrice),
      tokenGlobalOut,
      tokenAmountOut,
      relativePrice,
      baseFee,
      fallbackSpread,
      currentTimestamp,
    );*/
    return MathMMM.calcInGivenOut(
      tokenGlobalIn.info.balance,
      tokenGlobalIn.info.weight,
      tokenGlobalOut.info.balance,
      tokenGlobalOut.info.weight,
      tokenAmountOut,
      adaptiveFees,
    );
  }

  /**
   * @notice Computes the net value of a given tokenIn amount in tokenOut terms
   * @dev A spread is applied as soon as entering a "shortage of tokenOut" phase
   * cf whitepaper: https://www.swaap.finance/whitepaper.pdf
   * @param tokenGlobalIn The pool global information on tokenIn
   * @param tokenGlobalOut The pool global information on tokenOut
   * @param relativePrice The price of tokenOut in tokenIn terms
   * @param swapParameters Amount of token in and swap fee
   * @param gbmParameters The GBM forecast parameters (Z, horizon)
   * @param hpParameters The parameters for historical prices retrieval
   * @return swapResult The swap result (amount out, spread and tax base in)
   */
  static calcOutGivenInMMM(
    tokenGlobalIn: Struct.TokenGlobal,
    tokenGlobalOut: Struct.TokenGlobal,
    relativePrice: bigint,
    swapParameters: Struct.SwapParameters,
    gbmParameters: Struct.GBMParameters,
    hpParameters: Struct.HistoricalPricesParameters,
    historicalPricesIn: ChainLinkData,
    historicalPricesOut: ChainLinkData,
    currentTimestamp: bigint,
  ): Struct.SwapResult {
    // determines the balance of tokenIn at equilibrium (cf definitions)
    const balanceInAtEquilibrium = MathMMM.getTokenBalanceAtEquilibrium(
      tokenGlobalIn.info.balance,
      tokenGlobalIn.info.weight,
      tokenGlobalOut.info.balance,
      tokenGlobalOut.info.weight,
      relativePrice,
    );

    // from abundance of tokenOut to abundance of tokenOut --> no spread
    {
      if (
        tokenGlobalIn.info.balance < balanceInAtEquilibrium &&
        swapParameters.amount <
          balanceInAtEquilibrium - tokenGlobalIn.info.balance
      ) {
        return {
          amount: MathMMM._calcOutGivenInMMMAbundance(
            tokenGlobalIn,
            tokenGlobalOut,
            relativePrice,
            swapParameters.amount,
            swapParameters.fee,
            swapParameters.fallbackSpread,
            currentTimestamp,
          ),
          spread: 0n,
          taxBaseIn: 0n,
        };
      }
    }

    {
      const gbmEstimation = GeometricBrownianMotion.getParametersEstimation(
        tokenGlobalIn.latestRound,
        tokenGlobalOut.latestRound,
        hpParameters,
        historicalPricesIn,
        historicalPricesOut,
      );

      const [adjustedTokenOutWeight, spread] = MathMMM.getMMMWeight(
        true,
        swapParameters.fallbackSpread,
        tokenGlobalOut.info.weight,
        gbmEstimation,
        gbmParameters,
      );

      if (tokenGlobalIn.info.balance >= balanceInAtEquilibrium) {
        // shortage to shortage
        return {
          amount: MathMMM.calcOutGivenIn(
            tokenGlobalIn.info.balance,
            tokenGlobalIn.info.weight,
            tokenGlobalOut.info.balance,
            adjustedTokenOutWeight,
            swapParameters.amount,
            swapParameters.fee,
          ),
          spread: spread,
          taxBaseIn: swapParameters.amount,
        };
      } else {
        // abundance to shortage
        const [amount, taxBaseIn] = MathMMM._calcOutGivenInMMMMixed(
          tokenGlobalIn,
          tokenGlobalOut,
          swapParameters,
          relativePrice,
          adjustedTokenOutWeight,
          balanceInAtEquilibrium,
          currentTimestamp,
        );
        return {
          amount: amount,
          spread: spread,
          taxBaseIn: taxBaseIn,
        };
      }
    }
  }

  /**
   * @notice Implements 'calcOutGivenInMMM' in the case of mixed regime of tokenOut (abundance then shortage)
   * @param tokenGlobalIn The pool global information on tokenIn
   * @param tokenGlobalOut The pool global information on tokenOut
   * @param swapParameters The parameters of the swap
   * @param relativePrice The price of tokenOut in tokenIn terms
   * @param adjustedTokenWeightOut The spread-augmented tokenOut's weight
   * @param balanceInAtEquilibrium TokenIn balance at equilibrium
   * @return tokenAmountOut The total amount of token out
   * @return taxBaseIn The amount of tokenIn swapped when in shortage of tokenOut
   */
  static _calcOutGivenInMMMMixed(
    tokenGlobalIn: Struct.TokenGlobal,
    tokenGlobalOut: Struct.TokenGlobal,
    swapParameters: Struct.SwapParameters,
    relativePrice: bigint,
    adjustedTokenWeightOut: bigint,
    balanceInAtEquilibrium: bigint,
    currentTimestamp: bigint,
  ): [bigint, bigint] {
    const tokenInSellAmountForEquilibrium =
      balanceInAtEquilibrium - tokenGlobalIn.info.balance;
    const taxBaseIn = swapParameters.amount - tokenInSellAmountForEquilibrium;

    // 'abundance of tokenOut' phase --> no spread
    const tokenAmountOutPart1 = MathMMM._calcOutGivenInMMMAbundance(
      tokenGlobalIn,
      tokenGlobalOut,
      relativePrice,
      tokenInSellAmountForEquilibrium,
      swapParameters.fee,
      swapParameters.fallbackSpread,
      currentTimestamp,
    );

    // 'shortage of tokenOut phase' --> apply spread
    const tokenAmountOutPart2 = MathMMM.calcOutGivenIn(
      Num.add(tokenGlobalIn.info.balance, tokenInSellAmountForEquilibrium),
      tokenGlobalIn.info.weight,
      Num.sub(tokenGlobalOut.info.balance, tokenAmountOutPart1),
      adjustedTokenWeightOut,
      taxBaseIn, // tokenAmountIn > tokenInSellAmountForEquilibrium
      swapParameters.fee,
    );

    return [Num.add(tokenAmountOutPart1, tokenAmountOutPart2), taxBaseIn];
  }

  /**
   * @notice Implements calcOutGivenInMMM in the case of abundance of tokenOut
   * @dev A spread is applied as soon as entering a "shortage of tokenOut" phase
   * cf whitepaper: https://www.swaap.finance/whitepaper.pdf
   * @param tokenGlobalIn The pool global information on tokenIn
   * @param tokenGlobalOut The pool global information on tokenOut
   * @param relativePrice The price of tokenOut in tokenIn terms
   * @param tokenAmountIn The amount of tokenIn that will be swaped
   * @param baseFee The base fee
   * @param fallbackSpread The default spread in case the it couldn't be calculated using oracle prices
   * @return tokenAmountOut The tokenAmountOut when the tokenOut is in abundance
   */
  static _calcOutGivenInMMMAbundance(
    tokenGlobalIn: Struct.TokenGlobal,
    tokenGlobalOut: Struct.TokenGlobal,
    relativePrice: bigint,
    tokenAmountIn: bigint,
    baseFee: bigint,
    fallbackSpread: bigint,
    currentTimestamp: bigint,
  ): bigint {
    const adaptiveFees = baseFee; /*MathMMM.getAdaptiveFees(
      tokenGlobalIn,
      tokenAmountIn,
      tokenGlobalOut,
      Num.div(tokenAmountIn, relativePrice),
      relativePrice,
      baseFee,
      fallbackSpread,
      currentTimestamp,
    );*/
    return MathMMM.calcOutGivenIn(
      tokenGlobalIn.info.balance,
      tokenGlobalIn.info.weight,
      tokenGlobalOut.info.balance,
      tokenGlobalOut.info.weight,
      tokenAmountIn,
      adaptiveFees,
    );
  }

  /**
   * @notice Computes the log spread factor
   * @dev We define it as the log of the p-quantile of a GBM process (log-normal distribution),
   * which is given by the following:
   * mean * horizon + z * sqrt(2 * variance * horizon)
   * where z = ierf(2p - 1), with ierf being the inverse error function.
   * GBM: https://en.wikipedia.org/wiki/Geometric_Brownian_motion
   * Log-normal distribution: https://en.wikipedia.org/wiki/Log-normal_distribution
   * erf: https://en.wikipedia.org/wiki/Error_function
   * @param mean The percentage drift
   * @param variance The percentage volatility
   * @param horizon The GBM forecast horizon parameter
   * @param z The GBM forecast z parameter
   * @return x The log spread factor
   */
  static getLogSpreadFactor(
    mean: bigint,
    variance: bigint,
    horizon: bigint,
    z: bigint,
  ): bigint {
    if (mean == 0n && variance == 0n) {
      return 0n;
    }

    if (mean < 0) {
      mean = -Num.mul(-mean, horizon);
    } else {
      mean = Num.mul(mean, horizon);
    }

    let diffusion = 0n;
    if (variance > 0) {
      diffusion = Num.mul(
        z,
        LogExpMath.pow(Num.mul(variance, 2n * horizon), Const.ONE / 2n),
      );
    }
    return diffusion + mean;
  }

  /**
    * @notice Apply to the tokenWeight a 'spread' factor
    * @dev The spread factor is defined as the maximum between:
    a) the expected relative tokenOut increase in tokenIn terms
    b) 1
    * The function multiplies the tokenWeight by the spread factor if
    * the token is in shortage, or divides it by the spread factor if it is in abundance
    * @param shortage true when the token is in shortage, false if in abundance
    * @param fallbackSpread The default spread in case the it couldn't be calculated using oracle prices
    * @param tokenWeight The token's weight
    * @param gbmEstimation The GBM's 2 first moments estimation
    * @param gbmParameters The GBM forecast parameters (Z, horizon)
    * @return adjustedWeight The adjusted weight based on spread
    * @return spread The spread
    */
  static getMMMWeight(
    shortage: boolean,
    fallbackSpread: bigint,
    tokenWeight: bigint,
    gbmEstimation: Struct.GBMEstimation,
    gbmParameters: Struct.GBMParameters,
  ): [adjustedWeight: bigint, spread: bigint] {
    if (!gbmEstimation.success) {
      if (shortage) {
        return [
          Num.mul(tokenWeight, Const.ONE + fallbackSpread),
          fallbackSpread,
        ];
      } else {
        return [
          Num.div(tokenWeight, Const.ONE + fallbackSpread),
          fallbackSpread,
        ];
      }
    }

    if (gbmParameters.horizon == 0n) {
      return [tokenWeight, 0n];
    }

    const logSpreadFactor = MathMMM.getLogSpreadFactor(
      gbmEstimation.mean,
      gbmEstimation.variance,
      gbmParameters.horizon,
      gbmParameters.z,
    );
    if (logSpreadFactor <= 0) {
      return [tokenWeight, 0n];
    }
    const spreadFactor = LogExpMath.exp(logSpreadFactor);
    // if spread < 1 --> rounding error --> set to 1
    if (spreadFactor <= Const.ONE) {
      return [tokenWeight, 0n];
    }

    let spread = spreadFactor - Const.ONE;

    if (shortage) {
      return [Num.mul(tokenWeight, spreadFactor), spread];
    } else {
      return [Num.div(tokenWeight, spreadFactor), spread];
    }
  }

  /**
   * @notice Computes the fee amount that will ensure we maintain the pool's value, according to oracle prices.
   * @dev We apply this fee regime only if Out-In price increased in the same block as now.
   * @param tokenGlobalIn The pool global information on tokenIn
   * @param tokenAmountIn The swap desired amount for tokenIn
   * @param tokenGlobalOut The pool global information on tokenOut
   * @param tokenAmountOut The swap desired amount for tokenOut
   * @param relativePrice The price of tokenOut in tokenIn terms
   * @param baseFee The base fee amount
   * @param fallbackSpread The default spread in case the it couldn't be calculated using oracle prices
   * @return alpha The potentially augmented fee amount
   */
  /*  static getAdaptiveFees(
    tokenGlobalIn: Struct.TokenGlobal,
    tokenAmountIn: bigint,
    tokenGlobalOut: Struct.TokenGlobal,
    tokenAmountOut: bigint,
    relativePrice: bigint,
    baseFee: bigint,
    fallbackSpread: bigint,
    currentTimestamp: bigint,
  ): bigint {
    let blockTimestamp = currentTimestamp;

    // we only consider same block as last price update
    if (
      blockTimestamp != tokenGlobalIn.latestRound.timestamp &&
      blockTimestamp != tokenGlobalOut.latestRound.timestamp
    ) {
      // no additional fees
      return baseFee;
    }
    let recentPriceUpperBound = ChainlinkUtils.getMaxRelativePriceInLastBlock(
      tokenGlobalIn.latestRound,
      tokenGlobalIn.info.decimals,
      tokenGlobalOut.latestRound,
      tokenGlobalOut.info.decimals,
      // historicalPricesIn,
      // historicalPricesOut
    );
    if (recentPriceUpperBound == 0n) {
      // we were not able to retrieve the previous price
      return fallbackSpread;
    } else if (recentPriceUpperBound <= relativePrice) {
      // no additional fees
      return baseFee;
    }

    return (
      // additional fees indexed on price increase and imbalance
      Num.min(
        Const.ONE,
        baseFee +
          MathMMM.calcAdaptiveFeeGivenInAndOut(
            tokenGlobalIn.info.balance,
            tokenAmountIn,
            tokenGlobalIn.info.weight,
            tokenGlobalOut.info.balance,
            tokenAmountOut,
            tokenGlobalOut.info.weight,
          ),
      )
    );
  }
*/

  /**
   * @notice Computes the balance of token1 the pool must have in order to have token1/token2 at equilibrium
   * while satisfying the pricing curve prod^k balance_k^w_k = K
   * @dev We only rely on the following equations:
   * a) priceTokenOutOutInTokenIn = balance_in / balance_out * w_out / w_in
   * b) tokenBalanceOut = (K / prod_k!=in balance_k^w_k)^(1/w_out) = (localInvariant / balance_in^w_in)^(1/w_out)
   * with localInvariant = balance_in^w_in * balance_out^w_out which can be computed with only In/Out
   * @param tokenBalance1 The balance of token1 initially
   * @param tokenWeight1 The weight of token1
   * @param tokenBalance2 The balance of token2 initially
   * @param tokenWeight2 The weight of token2
   * @param relativePrice The price of tokenOut in tokenIn terms
   * @return balance1AtEquilibrium The balance of token1 in order to have a token1/token2 at equilibrium
   */
  static getTokenBalanceAtEquilibrium(
    tokenBalance1: bigint,
    tokenWeight1: bigint,
    tokenBalance2: bigint,
    tokenWeight2: bigint,
    relativePrice: bigint,
  ): bigint {
    const weightSum = tokenWeight1 + tokenWeight2;
    // relativePrice * weight1/weight2
    let foo = Num.mul(relativePrice, Num.div(tokenWeight1, tokenWeight2));
    // relativePrice * balance2 * (weight1/weight2)
    foo = Num.mul(foo, tokenBalance2);

    const balance1AtEquilibrium = Num.mul(
      LogExpMath.pow(foo, Num.div(tokenWeight2, weightSum)),
      LogExpMath.pow(tokenBalance1, Num.div(tokenWeight1, weightSum)),
    );

    return balance1AtEquilibrium;
  }

  /**
   * @notice Computes the fee needed to maintain the pool's value constant
   * @dev We use oracle to evaluate pool's value
   * @param tokenBalanceIn The balance of tokenIn initially
   * @param tokenAmountIn The amount of tokenIn to be added
   * @param tokenWeightIn The weight of tokenIn
   * @param tokenBalanceOut The balance of tokenOut initially
   * @param tokenAmountOut The amount of tokenOut to be removed from the pool
   * @param tokenWeightOut The weight of tokenOut
   * @return adaptiveFee The computed adaptive fee to be added to the base fees
   */
  static calcAdaptiveFeeGivenInAndOut(
    tokenBalanceIn: bigint,
    tokenAmountIn: bigint,
    tokenWeightIn: bigint,
    tokenBalanceOut: bigint,
    tokenAmountOut: bigint,
    tokenWeightOut: bigint,
  ): bigint {
    const weightRatio = Num.div(tokenWeightOut, tokenWeightIn);
    const y = Num.div(tokenBalanceOut, tokenBalanceOut - tokenAmountOut);
    const foo = Num.mul(tokenBalanceIn, Num.pow(y, weightRatio));

    const afterSwapTokenInBalance = tokenBalanceIn + tokenAmountIn;

    if (foo > afterSwapTokenInBalance) {
      return 0n;
    }
    return Num.div(afterSwapTokenInBalance - foo, tokenAmountIn);
  }
}
