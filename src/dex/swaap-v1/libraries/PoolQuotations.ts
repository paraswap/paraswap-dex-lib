import { Const } from './Const';
import { Num } from './Num';
import { MathMMM } from './MathMMM';
import * as Struct from './Struct';
import { ChainlinkUtils } from './ChainlinkUtils';
import {
  ChainLinkData,
  OracleData,
  TokenData,
  SwaapV1PoolParameters,
} from '../types';
import { DeepReadonly } from 'ts-essentials';

const _require = (b: boolean, message: string) => {
  if (!b) throw new Error(message);
};

export class PoolQuotations {
  /**
   * @return adjustedTokenWeight
   */
  static getTokenLatestInfo(
    tokenData: TokenData,
    oracleData: OracleData,
    currentTimestamp: bigint,
  ): Struct.TokenGlobal {
    const latestPrice =
      oracleData.historicalOracleState[oracleData.latestRoundId].answer;
    const latestTimestamp =
      oracleData.historicalOracleState[oracleData.latestRoundId].timestamp;

    const tokenRecord: Struct.TokenRecord = {
      decimals: BigInt(
        tokenData.decimals + oracleData.oraclesBindState.decimals,
      ),
      balance: tokenData.balance,
      weight: Num.mul(
        tokenData.initialWeight,
        // TODO: BigInt wrapper should be removed after fixing price type
        Num.div(latestPrice, BigInt(oracleData.oraclesBindState.price)),
      ),
    };

    const latestRound: Struct.LatestRound = ChainlinkUtils.getLatestRound(
      oracleData.latestRoundId,
      oracleData.historicalOracleState,
      currentTimestamp,
    );

    const tokenGlobal: Struct.TokenGlobal = {
      info: tokenRecord,
      latestRound: latestRound,
    };

    return tokenGlobal;
  }

  /**
   * @notice Computes the amount of tokenOut received when swapping a fixed amount of tokenIn
   * @param tokenIn The address of the input token
   * @param tokenAmountIn The fixed amount of tokenIn to be swapped
   * @param tokenOut The address of the received token
   * @param minAmountOut The minimum amount of tokenOut that can be received
   * @param maxPrice The maximum spot price accepted before the swap
   * @return swapResult The swap result (amount out, spread and tax base in)
   * @return priceResult The price result (spot price before & after the swap, latest oracle price in & out)
   */
  static getAmountOutGivenInMMM(
    tokenDataIn: DeepReadonly<TokenData>,
    oracleDataIn: DeepReadonly<OracleData>,
    tokenAmountIn: DeepReadonly<bigint>,
    tokenDataOut: DeepReadonly<TokenData>,
    oracleDataOut: DeepReadonly<OracleData>,
    // minAmountOut: DeepReadonly<bigint>,
    // maxPrice: DeepReadonly<bigint>,
    poolParameters: DeepReadonly<SwaapV1PoolParameters>,
    currentTimestamp: DeepReadonly<bigint>,
  ): bigint {
    _require(
      tokenAmountIn <= Num.mul(tokenDataIn.balance, Const.MAX_IN_RATIO),
      'Err.MAX_IN_RATIO',
    );

    let tokenGlobalIn = PoolQuotations.getTokenLatestInfo(
      tokenDataIn,
      oracleDataIn,
      currentTimestamp,
    );
    let tokenGlobalOut = PoolQuotations.getTokenLatestInfo(
      tokenDataOut,
      oracleDataOut,
      currentTimestamp,
    );

    let spotPriceBefore = MathMMM.calcSpotPrice(
      tokenDataIn.balance,
      tokenGlobalIn.info.weight,
      tokenDataOut.balance,
      tokenGlobalOut.info.weight,
      poolParameters.swapFee,
    );

    // _require(spotPriceBefore <= maxPrice, 'Err.BAD_LIMIT_PRICE');

    const swapResult = PoolQuotations.getAmountOutGivenInMMMWithTimestamp(
      tokenGlobalIn,
      tokenGlobalOut,
      tokenAmountIn,
      currentTimestamp,
      poolParameters,
      oracleDataIn.historicalOracleState,
      oracleDataOut.historicalOracleState,
    );
    // _require(swapResult.amount >= minAmountOut, 'Err.LIMIT_OUT');
    const spotPriceAfter = MathMMM.calcSpotPrice(
      tokenGlobalIn.info.balance + tokenAmountIn,
      tokenGlobalIn.info.weight,
      Num.sub(tokenGlobalOut.info.balance, swapResult.amount),
      tokenGlobalOut.info.weight,
      poolParameters.swapFee,
    );

    _require(spotPriceAfter >= spotPriceBefore, 'Err.MATH_APPROX');
    const maxAmount = Num.divTruncated(tokenAmountIn, spotPriceBefore);
    if (swapResult.amount > maxAmount) {
      swapResult.amount = maxAmount;
    }
    _require(
      Num.div(
        Num.mul(spotPriceAfter, Const.ONE - poolParameters.swapFee),
        ChainlinkUtils.getTokenRelativePrice(
          tokenGlobalIn.latestRound.price,
          tokenGlobalIn.info.decimals,
          tokenGlobalOut.latestRound.price,
          tokenGlobalOut.info.decimals,
        ),
      ) <= poolParameters.maxPriceUnpegRatio,
      'Err.MAX_PRICE_UNPEG_RATIO',
    );

    // const priceIn = tokenGlobalIn.latestRound.price;
    // const priceOut = tokenGlobalOut.latestRound.price;

    return swapResult.amount;
  }

  static getAmountOutGivenInMMMWithTimestamp(
    tokenGlobalIn: Struct.TokenGlobal,
    tokenGlobalOut: Struct.TokenGlobal,
    tokenAmountIn: bigint,
    currentTimestamp: bigint,
    poolParameters: SwaapV1PoolParameters,
    historicalPricesIn: ChainLinkData,
    historicalPricesOut: ChainLinkData,
  ): Struct.SwapResult {
    const swapParameters: Struct.SwapParameters = {
      amount: tokenAmountIn,
      fee: poolParameters.swapFee,
      fallbackSpread: Const.FALLBACK_SPREAD,
    };

    const gbmParameters: Struct.GBMParameters = {
      z: poolParameters.dynamicCoverageFeesZ,
      horizon: poolParameters.dynamicCoverageFeesHorizon,
    };

    const hpParameters: Struct.HistoricalPricesParameters = {
      lookbackInRound: poolParameters.priceStatisticsLookbackInRound,
      lookbackInSec: poolParameters.priceStatisticsLookbackInSec,
      timestamp: currentTimestamp,
      lookbackStepInRound: poolParameters.priceStatisticsLookbackStepInRound,
    };

    return MathMMM.calcOutGivenInMMM(
      tokenGlobalIn,
      tokenGlobalOut,
      ChainlinkUtils.getTokenRelativePrice(
        tokenGlobalIn.latestRound.price,
        tokenGlobalIn.info.decimals,
        tokenGlobalOut.latestRound.price,
        tokenGlobalOut.info.decimals,
      ),
      swapParameters,
      gbmParameters,
      hpParameters,
      historicalPricesIn,
      historicalPricesOut,
      currentTimestamp,
    );
  }

  static getAmountInGivenOutMMM(
    tokenDataIn: DeepReadonly<TokenData>,
    oracleDataIn: DeepReadonly<OracleData>,
    // maxAmountIn: DeepReadonly<bigint>,
    tokenDataOut: DeepReadonly<TokenData>,
    oracleDataOut: DeepReadonly<OracleData>,
    tokenAmountOut: DeepReadonly<bigint>,
    // maxPrice: DeepReadonly<bigint>,
    poolParameters: DeepReadonly<SwaapV1PoolParameters>,
    currentTimestamp: DeepReadonly<bigint>,
  ): bigint {
    _require(
      tokenAmountOut <= Num.mul(tokenDataOut.balance, Const.MAX_OUT_RATIO),
      'Err.MAX_OUT_RATIO',
    );

    const tokenGlobalIn = PoolQuotations.getTokenLatestInfo(
      tokenDataIn,
      oracleDataIn,
      currentTimestamp,
    );
    const tokenGlobalOut = PoolQuotations.getTokenLatestInfo(
      tokenDataOut,
      oracleDataOut,
      currentTimestamp,
    );

    const spotPriceBefore = MathMMM.calcSpotPrice(
      tokenGlobalIn.info.balance,
      tokenGlobalIn.info.weight,
      tokenGlobalOut.info.balance,
      tokenGlobalOut.info.weight,
      poolParameters.swapFee,
    );

    // _require(spotPriceBefore <= maxPrice, 'Err.BAD_LIMIT_PRICE');

    let swapResult = PoolQuotations.getAmountInGivenOutMMMWithTimestamp(
      tokenGlobalIn,
      tokenGlobalOut,
      tokenAmountOut,
      currentTimestamp,
      poolParameters,
      oracleDataIn.historicalOracleState,
      oracleDataOut.historicalOracleState,
    );

    // _require(swapResult.amount <= maxAmountIn, 'Err.LIMIT_IN');

    const spotPriceAfter = MathMMM.calcSpotPrice(
      tokenGlobalIn.info.balance + swapResult.amount,
      tokenGlobalIn.info.weight,
      Num.sub(tokenGlobalOut.info.balance, tokenAmountOut),
      tokenGlobalOut.info.weight,
      poolParameters.swapFee,
    );

    _require(spotPriceAfter >= spotPriceBefore, 'Err.MATH_APPROX');
    const minAmount = Num.mul(spotPriceBefore, tokenAmountOut) + 1n;
    if (swapResult.amount < minAmount) {
      swapResult.amount = minAmount;
    }
    _require(
      Num.div(
        Num.mul(spotPriceAfter, Const.ONE - poolParameters.swapFee),
        ChainlinkUtils.getTokenRelativePrice(
          tokenGlobalIn.latestRound.price,
          tokenGlobalIn.info.decimals,
          tokenGlobalOut.latestRound.price,
          tokenGlobalOut.info.decimals,
        ),
      ) <= poolParameters.maxPriceUnpegRatio,
      'Err.MAX_PRICE_UNPEG_RATIO',
    );

    return swapResult.amount;
  }

  static getAmountInGivenOutMMMWithTimestamp(
    tokenGlobalIn: Struct.TokenGlobal,
    tokenGlobalOut: Struct.TokenGlobal,
    tokenAmountOut: bigint,
    currentTimestamp: bigint,
    poolParameters: SwaapV1PoolParameters,
    historicalPricesIn: ChainLinkData,
    historicalPricesOut: ChainLinkData,
  ): Struct.SwapResult {
    const swapParameters: Struct.SwapParameters = {
      amount: tokenAmountOut,
      fee: poolParameters.swapFee,
      fallbackSpread: Const.FALLBACK_SPREAD,
    };

    const gbmParameters: Struct.GBMParameters = {
      z: poolParameters.dynamicCoverageFeesZ,
      horizon: poolParameters.dynamicCoverageFeesHorizon,
    };

    const hpParameters: Struct.HistoricalPricesParameters = {
      lookbackInRound: poolParameters.priceStatisticsLookbackInRound,
      lookbackInSec: poolParameters.priceStatisticsLookbackInSec,
      timestamp: currentTimestamp,
      lookbackStepInRound: poolParameters.priceStatisticsLookbackStepInRound,
    };

    const swapResult = MathMMM.calcInGivenOutMMM(
      tokenGlobalIn,
      tokenGlobalOut,
      ChainlinkUtils.getTokenRelativePrice(
        tokenGlobalIn.latestRound.price,
        tokenGlobalIn.info.decimals,
        tokenGlobalOut.latestRound.price,
        tokenGlobalOut.info.decimals,
      ),
      swapParameters,
      gbmParameters,
      hpParameters,
      historicalPricesIn,
      historicalPricesOut,
      currentTimestamp,
    );

    return swapResult;
  }
}
