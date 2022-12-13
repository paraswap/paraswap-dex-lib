import { Const } from './Const';
import { Num } from './Num';
import * as Struct from './Struct';
import { ChainLinkData } from '../types';

const _require = (b: boolean, message: string) => {
  if (!b) throw new Error(message);
};

export class ChainlinkUtils {
  static getLatestRound(
    latestRoundId: number,
    historicalPrices: ChainLinkData,
    currentTimestamp: bigint,
  ): Struct.LatestRound {
    let latestRoundData = historicalPrices[latestRoundId];

    let latestPrice = latestRoundData.answer;
    let latestTimestamp = latestRoundData.timestamp;

    _require(
      currentTimestamp - latestTimestamp <= Const.ORACLE_TIMEOUT,
      'Err.EXCEEDED_ORACLE_TIMEOUT',
    );
    _require(latestPrice > 0, 'Err.NON_POSITIVE_PRICE');

    return {
      roundId: latestRoundId,
      price: latestPrice,
      timestamp: latestTimestamp,
    };
  }

  /**
   * @notice Retrieves historical data from round id.
   * @dev Special cases:
   * - if retrieved price is negative --> fails
   * - if no data can be found --> returns (0,0)
   * @param oracle The price feed oracle
   * @param _roundId The the round of interest ID
   * @return The round price
   * @return The round timestamp
   */
  static getRoundData(
    _roundId: number,
    historicalPrices: ChainLinkData,
  ): [bigint, bigint] {
    let data = historicalPrices[_roundId];

    _require(data != undefined, 'Err.UNAVAILABLE_HISTORICAL_PRICE');
    _require(data.answer >= 0, 'Err.NEGATIVE_PRICE');

    return [data.answer, data.timestamp];
  }

  /**
   * @notice Computes the price of token 2 in terms of token 1
   * @param price_1 The latest price data for token 1
   * @param decimals_1 The sum of the decimals of token 1 its oracle
   * @param price_2 The latest price data for token 2
   * @param decimals_2 The sum of the decimals of token 2 its oracle
   * @return The last price of token 2 divded by the last price of token 1
   */
  static getTokenRelativePrice(
    price_1: bigint,
    decimals_1: bigint,
    price_2: bigint,
    decimals_2: bigint,
  ): bigint {
    // we consider tokens price to be > 0
    if (decimals_1 > decimals_2) {
      return Num.div(
        Num.mul(price_2, 10n ** (decimals_1 - decimals_2) * Const.ONE),
        price_1,
      );
    } else if (decimals_1 < decimals_2) {
      return Num.div(
        Num.div(price_2, price_1),
        10n ** (decimals_2 - decimals_1) * Const.ONE,
      );
    } else {
      // decimals_1 == decimals_2
      return Num.div(price_2, price_1);
    }
  }

  /**
   * @notice Computes the previous price of tokenIn in terms of tokenOut 's upper bound
   * @param latestRound_1 The token_1's latest round
   * @param decimals_1 The sum of the decimals of token 1 its oracle
   * @param latestRound_2 The token_2's latest round
   * @param decimals_2 The sum of the decimals of token 2 its oracle
   * @return The ratio of token 2 and token 1 values if well defined, else 0
   */
  /*
  static getMaxRelativePriceInLastBlock(
    latestRound_1: Struct.LatestRound,
    decimals_1: bigint,
    latestRound_2: Struct.LatestRound,
    decimals_2: bigint,
    // historicalPricesIn: ChainLinkData,
    // historicalPricesOut: ChainLinkData,
    // currentTimestamp: bigint
  ): bigint {
    let minPrice_1 = latestRound_1.price;

      let timestamp_1  = latestRound_1.timestamp;
      let temp_price_1;
      let roundId_1    = latestRound_1.roundId;
      // let oracle_1     = latestRound_1.oracle;

      while (timestamp_1 == currentTimestamp) {
          --roundId_1;
          let [temp_price_1, timestamp_1] = ChainlinkUtils.getRoundData(
              roundId_1, historicalPricesIn
          );
          if (temp_price_1 == 0n) {
              return 0n;
          }
          if (temp_price_1 < minPrice_1) {
              minPrice_1 = temp_price_1;
          }
      }
      
    let maxPrice_2 = latestRound_2.price;
    
      let timestamp_2  = latestRound_2.timestamp;
      let temp_price_2;
      let  roundId_2    = latestRound_2.roundId;

      while (timestamp_2 == currentTimestamp) {
          --roundId_2;
          let [temp_price_2, timestamp_2] = ChainlinkUtils.getRoundData(
              roundId_2, historicalPricesOut
          );
          if (temp_price_2 == 0n) {
              return 0n;
          }
          if (temp_price_2 > maxPrice_2) {
              maxPrice_2 = temp_price_2;
          }
      }

    return ChainlinkUtils.getTokenRelativePrice(
      minPrice_1,
      decimals_1,
      maxPrice_2,
      decimals_2,
    );
  }
*/
}
