import { Const } from './Const';
import { Num } from './Num';
import { LogExpMath } from './LogExpMath';
import * as Struct from './Struct';
import { ChainlinkUtils } from './ChainlinkUtils';
import { ChainLinkData, OracleData } from '../types';

export class GeometricBrownianMotion {
  /**
   * @notice Gets asset-pair approximate historical return's mean and variance
   * @param latestRoundIn The round-to-start-from's data including its ID of tokenIn
   * @param latestRoundOut The round-to-start-from's data including its ID of tokenOut
   * @param hpParameters The parameters for historical prices retrieval
   * @return gbmEstimation The asset-pair historical return's mean and variance
   */
  static getParametersEstimation(
    latestRoundIn: Struct.LatestRound,
    latestRoundOut: Struct.LatestRound,
    hpParameters: Struct.HistoricalPricesParameters,
    historicalOracleStateIn: ChainLinkData,
    historicalOracleStateOut: ChainLinkData,
  ): Struct.GBMEstimation {
    // retrieve historical prices of tokenIn
    let [pricesIn, timestampsIn, startIndexIn, noMoreDataPointIn] =
      GeometricBrownianMotion.getHistoricalPrices(
        latestRoundIn,
        hpParameters,
        historicalOracleStateIn,
      );
    if (!noMoreDataPointIn && startIndexIn < hpParameters.lookbackInRound - 1) {
      return {
        mean: 0n,
        variance: 0n,
        success: false,
      };
    }

    let reducedLookbackInSecCandidate =
      hpParameters.timestamp - timestampsIn[startIndexIn];
    if (reducedLookbackInSecCandidate < hpParameters.lookbackInSec) {
      hpParameters.lookbackInSec = reducedLookbackInSecCandidate;
    }

    // retrieve historical prices of tokenOut
    let [pricesOut, timestampsOut, startIndexOut, noMoreDataPointOut] =
      GeometricBrownianMotion.getHistoricalPrices(
        latestRoundOut,
        hpParameters,
        historicalOracleStateOut,
      );
    if (
      !noMoreDataPointOut &&
      startIndexOut < hpParameters.lookbackInRound - 1
    ) {
      return {
        mean: 0n,
        variance: 0n,
        success: false,
      };
    }

    return GeometricBrownianMotion._getParametersEstimation(
      noMoreDataPointIn && noMoreDataPointOut,
      { startIndex: startIndexIn, timestamps: timestampsIn, prices: pricesIn },
      {
        startIndex: startIndexOut,
        timestamps: timestampsOut,
        prices: pricesOut,
      },
      hpParameters,
    );
  }

  /**
   * @notice Gets asset-pair historical data return's mean and variance
   * @param noMoreDataPoints True if and only if the retrieved data span over the whole time window of interest
   * @param hpDataIn Historical prices data of tokenIn
   * @param hpDataOut Historical prices data of tokenOut
   * @param hpParameters The parameters for historical prices retrieval
   * @return gbmEstimation The asset-pair historical return's mean and variance
   */
  static _getParametersEstimation(
    noMoreDataPoints: boolean,
    hpDataIn: Struct.HistoricalPricesData,
    hpDataOut: Struct.HistoricalPricesData,
    hpParameters: Struct.HistoricalPricesParameters,
  ): Struct.GBMEstimation {
    // no price return can be calculated with only 1 data point
    if (hpDataIn.startIndex == 0 && hpDataOut.startIndex == 0) {
      return {
        mean: 0n,
        variance: 0n,
        success: true,
      };
    }

    if (noMoreDataPoints) {
      let ts = hpParameters.timestamp - hpParameters.lookbackInSec;
      hpDataIn.timestamps[hpDataIn.startIndex] = ts;
      hpDataOut.timestamps[hpDataOut.startIndex] = ts;
    } else {
      GeometricBrownianMotion.consolidateStartIndices(hpDataIn, hpDataOut);
      // no price return can be calculated with only 1 data point
      if (hpDataIn.startIndex == 0 && hpDataOut.startIndex == 0) {
        return {
          mean: 0n,
          variance: 0n,
          success: true,
        };
      }
    }
    let [values, timestamps] = GeometricBrownianMotion.getSeries(
      hpDataIn.prices,
      hpDataIn.timestamps,
      hpDataIn.startIndex,
      hpDataOut.prices,
      hpDataOut.timestamps,
      hpDataOut.startIndex,
    );
    let [mean, variance] = GeometricBrownianMotion.getStatistics(
      values,
      timestamps,
    );

    return {
      mean: mean,
      variance: variance,
      success: true,
    };
  }

  /**
   * @notice Gets asset-pair historical prices with timestamps
   * @param pricesIn The historical prices of tokenIn
   * @param timestampsIn The timestamps corresponding to the tokenIn's historical prices
   * @param startIndexIn The tokenIn historical data's last valid index
   * @param pricesOut The tokenIn historical data's last valid index
   * @param timestampsOut The timestamps corresponding to the tokenOut's historical prices
   * @param startIndexOut The tokenOut historical data's last valid index
   * @return values The asset-pair historical prices array
   * @return timestamps The asset-pair historical timestamps array
   */
  static getSeries(
    pricesIn: bigint[],
    timestampsIn: bigint[],
    startIndexIn: number,
    pricesOut: bigint[],
    timestampsOut: bigint[],
    startIndexOut: number,
  ): [bigint[], bigint[]] {
    let values, timestamps;
    // compute the number of returns
    let count = 1;
    {
      let _startIndexIn = startIndexIn;
      let _startIndexOut = startIndexOut;
      let skip = true;
      while (_startIndexIn > 0 || _startIndexOut > 0) {
        [skip, _startIndexIn, _startIndexOut] =
          GeometricBrownianMotion.getNextSample(
            _startIndexIn,
            _startIndexOut,
            timestampsIn,
            timestampsOut,
          );
        if (!skip) {
          count += 1;
        }
      }
      values = new Array<bigint>(count);
      timestamps = new Array<bigint>(count);
      values[0] = Num.div(pricesOut[startIndexOut], pricesIn[startIndexIn]);
      timestamps[0] =
        Num.max(timestampsOut[startIndexOut], timestampsIn[startIndexIn]) *
        Const.ONE;
    }

    // compute actual returns
    {
      count = 1;
      let skip = true;
      while (startIndexIn > 0 || startIndexOut > 0) {
        [skip, startIndexIn, startIndexOut] =
          GeometricBrownianMotion.getNextSample(
            startIndexIn,
            startIndexOut,
            timestampsIn,
            timestampsOut,
          );
        if (!skip) {
          values[count] = Num.div(
            pricesOut[startIndexOut],
            pricesIn[startIndexIn],
          );
          timestamps[count] =
            Num.max(timestampsOut[startIndexOut], timestampsIn[startIndexIn]) *
            Const.ONE;
          count += 1;
        }
      }
    }

    return [values, timestamps];
  }

  /**
   * @notice Gets asset-pair historical mean/variance from timestamped data
   * @param values The historical values
   * @param timestamps The corresponding time deltas, in seconds
   * @return mean The asset-pair historical return's mean
   * @return variance asset-pair historical return's variance
   */
  static getStatistics(
    values: bigint[],
    timestamps: bigint[],
  ): [bigint, bigint] {
    let n = values.length;
    if (n < 2) {
      return [0n, 0n];
    }
    n -= 1;

    let tWithPrecision = timestamps[n] - timestamps[0];

    // mean
    let mean = Num.divInt256(
      LogExpMath.ln(Num.divInt256(values[n], values[0])),
      tWithPrecision,
    );

    let meanSquare;
    if (mean < 0) {
      meanSquare = Num.mul(-mean, -mean);
    } else {
      meanSquare = Num.mul(mean, mean);
    }

    // variance
    let variance = -Num.mul(meanSquare, tWithPrecision);
    for (let i = 1; i <= n; i++) {
      let d = LogExpMath.ln(Num.divInt256(values[i], values[i - 1]));
      if (d < 0) {
        d = -d;
      }
      let dAbs = d;
      variance += Num.div(
        Num.mul(dAbs, dAbs),
        timestamps[i] - timestamps[i - 1],
      );
    }
    variance = Num.divInt256(variance, BigInt(n) * Const.ONE);
    return [mean, Num.positivePart(variance)];
  }

  /**
   * @notice Gets historical prices from a Chainlink data feed
   * @dev Few specificities:
   * - it filters out round data with null price or timestamp
   * - it stops filling the prices/timestamps when:
   * a) hpParameters.lookbackInRound rounds have already been found
   * b) time window induced by hpParameters.lookbackInSec is no more satisfied
   * @param latestRound The round-to-start-from's data including its ID
   * @param hpParameters The parameters for historical prices retrieval
   * @return historicalPrices The historical prices of a token
   * @return historicalTimestamps The timestamps of the reported prices
   * @return index The last valid index of the returned arrays
   * @return noMoreDataPoints True if the reported historical prices reaches the lookback time limit
   */
  static getHistoricalPrices(
    latestRound: Struct.LatestRound,
    hpParameters: Struct.HistoricalPricesParameters,
    historicalOracleState: ChainLinkData,
  ): [bigint[], bigint[], number, boolean] {
    let latestTimestamp = latestRound.timestamp;

    // historical price endtimestamp >= lookback window or it reverts
    let timeLimit = Num.sub(hpParameters.timestamp, hpParameters.lookbackInSec);

    // result variables
    let prices = new Array<bigint>(hpParameters.lookbackInRound);
    let timestamps = new Array<bigint>(hpParameters.lookbackInRound);
    let idx = 1;

    {
      prices[0] = latestRound.price; // is supposed to be well valid
      timestamps[0] = latestTimestamp; // is supposed to be well valid

      if (latestTimestamp < timeLimit) {
        return [prices, timestamps, 0, true];
      }

      let count = 1;

      // buffer variables
      let _roundId = latestRound.roundId;

      while (
        _roundId >= hpParameters.lookbackStepInRound &&
        count < hpParameters.lookbackInRound
      ) {
        _roundId -= hpParameters.lookbackStepInRound;
        let [_price, _timestamp] = ChainlinkUtils.getRoundData(
          _roundId,
          historicalOracleState,
        );

        if (_price > 0 && _timestamp > 0) {
          prices[idx] = _price;
          timestamps[idx] = _timestamp;
          idx += 1;

          if (_timestamp < timeLimit) {
            return [prices, timestamps, idx - 1, true];
          }
        }

        count += 1;
      }
    }

    return [prices, timestamps, idx - 1, false];
  }

  /**
   * @notice Finds the next data point in chronological order
   * @dev Few considerations:
   * - data point with same timestamp as previous point are tagged with a 'skip=true'
   * - when we reach the last point of a token, we consider it's value constant going forward with the other token
   * As a result the variance of those returns will be underestimated.
   * @param startIndexIn  The tokenIn historical data's last valid index
   * @param startIndexOut The tokenOut historical data's last valid index
   * @param timestampsIn  The timestamps corresponding to the tokenIn's historical prices
   * @param timestampsOut The timestamps corresponding to the tokenOut's historical prices
   * @return skip The 'skip' tag
   * @return startIndexIn The updated startIndexIn
   * @return startIndexOut The updated startIndexOut
   */
  static getNextSample(
    startIndexIn: number,
    startIndexOut: number,
    timestampsIn: bigint[],
    timestampsOut: bigint[],
  ): [boolean, number, number] {
    let skip = true;
    let nextStartIndexIn = startIndexIn > 0 ? startIndexIn - 1 : startIndexIn;
    let nextStartIndexOut =
      startIndexOut > 0 ? startIndexOut - 1 : startIndexOut;
    if (timestampsIn[nextStartIndexIn] == timestampsOut[nextStartIndexOut]) {
      if (
        timestampsIn[nextStartIndexIn] != timestampsIn[startIndexIn] &&
        timestampsOut[nextStartIndexOut] != timestampsOut[startIndexOut]
      ) {
        skip = false;
      }
      if (startIndexIn > 0) {
        startIndexIn--;
      }
      if (startIndexOut > 0) {
        startIndexOut--;
      }
    } else {
      if (startIndexOut == 0) {
        if (timestampsIn[nextStartIndexIn] != timestampsIn[startIndexIn]) {
          skip = false;
        }
        if (startIndexIn > 0) {
          startIndexIn--;
        }
      } else if (startIndexIn == 0) {
        if (timestampsOut[nextStartIndexOut] != timestampsOut[startIndexOut]) {
          skip = false;
        }
        if (startIndexOut > 0) {
          startIndexOut--;
        }
      } else {
        if (timestampsIn[nextStartIndexIn] < timestampsOut[nextStartIndexOut]) {
          if (timestampsIn[nextStartIndexIn] != timestampsIn[startIndexIn]) {
            skip = false;
          }
          if (startIndexIn > 0) {
            startIndexIn--;
          }
        } else {
          if (
            timestampsOut[nextStartIndexOut] != timestampsOut[startIndexOut]
          ) {
            skip = false;
          }
          if (startIndexOut > 0) {
            startIndexOut--;
          }
        }
      }
    }
    return [skip, startIndexIn, startIndexOut];
  }

  /**
   * @notice Consolidate the last valid indexes of tokenIn and tokenOut
   * @param hpDataIn Historical prices data of tokenIn
   * @param hpDataOut Historical prices data of tokenOut
   */
  static consolidateStartIndices(
    hpDataIn: Struct.HistoricalPricesData,
    hpDataOut: Struct.HistoricalPricesData,
  ) {
    // trim prices/timestamps by adjusting startIndexes
    if (
      hpDataIn.timestamps[hpDataIn.startIndex] >
      hpDataOut.timestamps[hpDataOut.startIndex]
    ) {
      while (
        hpDataOut.startIndex > 0 &&
        hpDataOut.timestamps[hpDataOut.startIndex - 1] <=
          hpDataIn.timestamps[hpDataIn.startIndex]
      ) {
        --hpDataOut.startIndex;
      }
    } else if (
      hpDataIn.timestamps[hpDataIn.startIndex] <
      hpDataOut.timestamps[hpDataOut.startIndex]
    ) {
      while (
        hpDataIn.startIndex > 0 &&
        hpDataIn.timestamps[hpDataIn.startIndex - 1] <=
          hpDataOut.timestamps[hpDataOut.startIndex]
      ) {
        --hpDataIn.startIndex;
      }
    }
  }
}
