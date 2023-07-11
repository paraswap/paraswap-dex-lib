import { assert } from 'ts-essentials';
import {
  _require,
  int24,
  int56,
  uint16,
  uint160,
  uint256,
  uint88,
} from '../../../utils';

// TO COMPARE WITH https://github.com/cryptoalgebra/Algebra/blob/d4c1a57accf5e14d542c534c6c724a620565c176/src/core/contracts/libraries/DataStorage.sol#L9

/// @title DataStorage
/// @notice Provides price, liquidity, volatility data useful for a wide variety of system designs
/// @dev Instances of stored dataStorage data, "timepoints", are collected in the dataStorage array
/// Timepoints are overwritten when the full length of the dataStorage array is populated.
/// The most recent timepoint is available by passing 0 to getSingleTimepoint()

interface Timepoint {
  initialized: boolean; // whether or not the timepoint is initialized
  blockTimestamp: bigint; // the block timestamp of the timepoint
  tickCumulative: bigint; // the tick accumulator, i.e. tick * time elapsed since the pool was first initialized
  secondsPerLiquidityCumulative: bigint; // the seconds per liquidity since the pool was first initialized
  volatilityCumulative: bigint; // the volatility accumulator; overflow after ~34800 years is desired :)
  averageTick: bigint; // average tick at this blockTimestamp
  volumePerLiquidityCumulative: bigint; // the gmean(volumes)/liquidity accumulator
}

const WINDOW = 24n * 60n;
const UINT16_MODULO = 65536n;

export class DataStorage {
  static WINDOW = WINDOW;
  static UINT16_MODULO = UINT16_MODULO;
  /// @notice Calculates volatility between two sequential timepoints with resampling to 1 sec frequency
  /// @param dt Timedelta between timepoints, must be within uint32 range
  /// @param tick0 The tick at the left timepoint, must be within int24 range
  /// @param tick1 The tick at the right timepoint, must be within int24 range
  /// @param avgTick0 The average tick at the left timepoint, must be within int24 range
  /// @param avgTick1 The average tick at the right timepoint, must be within int24 range
  /// @return volatility The volatility between two sequential timepoints
  /// If the requirements for the parameters are met, it always fits 88 bits
  static _volatilityOnRange(
    dt: bigint,
    tick0: bigint,
    tick1: bigint,
    avgTick0: bigint,
    avgTick1: bigint,
  ): bigint {
    // On the time interval from the previous timepoint to the current
    // we can represent tick and average tick change as two straight lines:
    // tick = k*t + b, where k and b are some constants
    // avgTick = p*t + q, where p and q are some constants
    // we want to get sum of (tick(t) - avgTick(t))^2 for every t in the interval (0; dt]
    // so: (tick(t) - avgTick(t))^2 = ((k*t + b) - (p*t + q))^2 = (k-p)^2 * t^2 + 2(k-p)(b-q)t + (b-q)^2
    // since everything except t is a constant, we need to use progressions for t and t^2:
    // sum(t) for t from 1 to dt = dt*(dt + 1)/2 = sumOfSequence
    // sum(t^2) for t from 1 to dt = dt*(dt+1)*(2dt + 1)/6 = sumOfSquares
    // so result will be: (k-p)^2 * sumOfSquares + 2(k-p)(b-q)*sumOfSequence + dt*(b-q)^2
    const K = tick1 - tick0 - (avgTick1 - avgTick0); // (k - p)*dt
    const B = (tick0 - avgTick0) * dt; // (b - q)*dt
    const sumOfSquares = dt * (dt + 1n) * (2n * dt + 1n); // sumOfSquares * 6
    const sumOfSequence = dt * (dt + 1n); // sumOfSequence * 2
    const volatility = uint256(
      (K ** 2n * sumOfSquares +
        6n * B * K * sumOfSequence +
        6n * dt * B ** 2n) /
        (6n * dt ** 2n),
    );

    return volatility;
  }

  /// @notice Transforms a previous timepoint into a new timepoint, given the passage of time and the current tick and liquidity values
  /// @dev blockTimestamp _must_ be chronologically equal to or greater than last.blockTimestamp, safe for 0 or 1 overflows
  /// @param last The specified timepoint to be used in creation of new timepoint
  /// @param blockTimestamp The timestamp of the new timepoint
  /// @param tick The active tick at the time of the new timepoint
  /// @param prevTick The active tick at the time of the last timepoint
  /// @param liquidity The total in-range liquidity at the time of the new timepoint
  /// @param averageTick The average tick at the time of the new timepoint
  /// @param volumePerLiquidity The gmean(volumes)/liquidity at the time of the new timepoint
  /// @return Timepoint The newly populated timepoint
  static createNewTimepoint(
    last: Timepoint,
    blockTimestamp: bigint,
    tick: bigint,
    prevTick: bigint,
    liquidity: bigint,
    averageTick: bigint,
    volumePerLiquidity: bigint,
  ): Timepoint {
    const delta = blockTimestamp - last.blockTimestamp;

    last.initialized = true;
    last.blockTimestamp = blockTimestamp;
    last.tickCumulative += int56(tick) * delta;
    last.secondsPerLiquidityCumulative +=
      (uint160(delta) << 128n) / (liquidity > 0n ? liquidity : 1n); // just timedelta if liquidity == 0
    last.volatilityCumulative += uint88(
      this._volatilityOnRange(
        delta,
        prevTick,
        tick,
        last.averageTick,
        averageTick,
      ),
    ); // always fits 88 bits
    last.averageTick = averageTick;
    last.volumePerLiquidityCumulative += volumePerLiquidity;

    return last;
  }

  /// @notice comparator for 32-bit timestamps
  /// @dev safe for 0 or 1 overflows, a and b _must_ be chronologically before or equal to currentTime
  /// @param a A comparison timestamp from which to determine the relative position of `currentTime`
  /// @param b From which to determine the relative position of `currentTime`
  /// @param currentTime A timestamp truncated to 32 bits
  /// @return res Whether `a` is chronologically <= `b`
  static lteConsideringOverflow(
    a: bigint,
    b: bigint,
    currentTime: bigint,
  ): boolean {
    let res = a > currentTime;
    if (res == b > currentTime) res = a <= b; // if both are on the same side
    return res;
  }

  /// @dev guaranteed that the result is within the bounds of int24
  /// returns int256 for fuzzy tests
  static _getAverageTick(
    self: Record<number, Timepoint>,
    time: bigint,
    tick: bigint,
    index: bigint,
    oldestIndex: bigint,
    lastTimestamp: bigint,
    lastTickCumulative: bigint,
  ): bigint {
    const oldestTimestamp = self[Number(oldestIndex)].blockTimestamp;
    const oldestTickCumulative = self[Number(oldestIndex)].tickCumulative;

    let avgTick;

    if (this.lteConsideringOverflow(oldestTimestamp, time - WINDOW, time)) {
      if (this.lteConsideringOverflow(lastTimestamp, time - WINDOW, time)) {
        index -= 1n; // considering underflow
        const startTimepoint = self[Number(index)];
        avgTick = startTimepoint.initialized
          ? (lastTickCumulative - startTimepoint.tickCumulative) /
            (lastTimestamp - startTimepoint.blockTimestamp)
          : tick;
      } else {
        const startOfWindow = this.getSingleTimepoint(
          self,
          time,
          WINDOW,
          tick,
          index,
          oldestIndex,
          0n,
        );

        //    current-WINDOW  last   current
        // _________*____________*_______*_
        //           ||||||||||||
        avgTick =
          (lastTickCumulative - startOfWindow.tickCumulative) /
          (lastTimestamp - time + WINDOW);
      }
    } else {
      avgTick =
        lastTimestamp == oldestTimestamp
          ? tick
          : (lastTickCumulative - oldestTickCumulative) /
            (lastTimestamp - oldestTimestamp);
    }

    return avgTick;
  }

  /// @notice Fetches the timepoints beforeOrAt and atOrAfter a target, i.e. where [beforeOrAt, atOrAfter] is satisfied.
  /// The result may be the same timepoint, or adjacent timepoints.
  /// @dev The answer must be contained in the array, used when the target is located within the stored timepoint
  /// boundaries: older than the most recent timepoint and younger, or the same age as, the oldest timepoint
  /// @param self The stored dataStorage array
  /// @param time The current block.timestamp
  /// @param target The timestamp at which the reserved timepoint should be for
  /// @param lastIndex The index of the timepoint that was most recently written to the timepoints array
  /// @param oldestIndex The index of the oldest timepoint in the timepoints array
  /// @return beforeOrAt The timepoint recorded before, or at, the target
  /// @return atOrAfter The timepoint recorded at, or after, the target
  static binarySearch(
    self: Record<number, Timepoint>,
    time: bigint,
    target: bigint,
    lastIndex: bigint,
    oldestIndex: bigint,
  ): [Timepoint, Timepoint] {
    let left = oldestIndex; // oldest timepoint
    let right =
      lastIndex >= oldestIndex ? lastIndex : lastIndex + UINT16_MODULO; // newest timepoint considering one index overflow
    let current = (left + right) >> 1n; // "middle" point between the boundaries

    let beforeOrAt;
    let atOrAfter;
    let initializedAfter;
    let timestampAfter;

    do {
      beforeOrAt = self[Number(uint16(current))]; // checking the "middle" point between the boundaries
      let [initializedBefore, timestampBefore] = [
        beforeOrAt.initialized,
        beforeOrAt.blockTimestamp,
      ];
      if (initializedBefore) {
        if (this.lteConsideringOverflow(timestampBefore, target, time)) {
          // is current point before or at `target`?
          atOrAfter = self[Number(uint16(current + 1n))]; // checking the next point after "middle"
          [initializedAfter, timestampAfter] = [
            atOrAfter.initialized,
            atOrAfter.blockTimestamp,
          ];
          if (initializedAfter) {
            if (this.lteConsideringOverflow(target, timestampAfter, time)) {
              // is the "next" point after or at `target`?
              return [beforeOrAt, atOrAfter]; // the only fully correct way to finish
            }
            left = current + 1n; // "next" point is before the `target`, so looking in the right half
          } else {
            // beforeOrAt is initialized and <= target, and next timepoint is uninitialized
            // should be impossible if initial boundaries and `target` are correct
            return [beforeOrAt, beforeOrAt];
          }
        } else {
          right = current - 1n; // current point is after the `target`, so looking in the left half
        }
      } else {
        // we've landed on an uninitialized timepoint, keep searching higher
        // should be impossible if initial boundaries and `target` are correct
        left = current + 1n;
      }
      current = (left + right) >> 1n; // calculating the new "middle" point index after updating the bounds
    } while (true); // protect with max nb of iterations?

    // unreachable code here
    // atOrAfter = beforeOrAt; // code is unreachable, to suppress compiler warning
    // assert(false);

    // return [beforeOrAt, atOrAfter]
  }

  /// @dev Reverts if an timepoint at or before the desired timepoint timestamp does not exist.
  /// 0 may be passed as `secondsAgo' to return the current cumulative values.
  /// If called with a timestamp falling between two timepoints, returns the counterfactual accumulator values
  /// at exactly the timestamp between the two timepoints.
  /// @param self The stored dataStorage array
  /// @param time The current block timestamp
  /// @param secondsAgo The amount of time to look back, in seconds, at which point to return an timepoint
  /// @param tick The current tick
  /// @param index The index of the timepoint that was most recently written to the timepoints array
  /// @param oldestIndex The index of the oldest timepoint
  /// @param liquidity The current in-range pool liquidity
  /// @return targetTimepoint desired timepoint or it's approximation
  static getSingleTimepoint(
    self: Record<number, Timepoint>,
    time: bigint,
    secondsAgo: bigint,
    tick: bigint,
    index: bigint,
    oldestIndex: bigint,
    liquidity: bigint,
  ): Timepoint {
    let target = time - secondsAgo;

    // if target is newer than last timepoint
    if (
      secondsAgo == 0n ||
      this.lteConsideringOverflow(
        self[Number(index)].blockTimestamp,
        target,
        time,
      )
    ) {
      let last = self[Number(index)];
      if (last.blockTimestamp == target) {
        return last;
      } else {
        // otherwise, we need to add new timepoint
        let avgTick = int24(
          this._getAverageTick(
            self,
            time,
            tick,
            index,
            oldestIndex,
            last.blockTimestamp,
            last.tickCumulative,
          ),
        );
        let prevTick = tick;
        {
          if (index != oldestIndex) {
            // FIXME?
            let prevLast: Timepoint = {
              averageTick: 0n,
              blockTimestamp: 0n,
              initialized: false,
              secondsPerLiquidityCumulative: 0n,
              tickCumulative: 0n,
              volatilityCumulative: 0n,
              volumePerLiquidityCumulative: 0n,
            };
            let _prevLast = self[Number(index - 1n)]; // considering index underflow
            prevLast.blockTimestamp = _prevLast.blockTimestamp;
            prevLast.tickCumulative = _prevLast.tickCumulative;
            prevTick = int24(
              (last.tickCumulative - prevLast.tickCumulative) /
                (last.blockTimestamp - prevLast.blockTimestamp),
            );
          }
        }
        return this.createNewTimepoint(
          last,
          target,
          tick,
          prevTick,
          liquidity,
          avgTick,
          0n,
        );
      }
    }

    _require(
      this.lteConsideringOverflow(
        self[Number(oldestIndex)].blockTimestamp,
        target,
        time,
      ),
      'OLD',
    );
    let [beforeOrAt, atOrAfter] = this.binarySearch(
      self,
      time,
      target,
      index,
      oldestIndex,
    );

    if (target == atOrAfter.blockTimestamp) {
      return atOrAfter; // we're at the right boundary
    }

    if (target != beforeOrAt.blockTimestamp) {
      // we're in the middle
      let timepointTimeDelta =
        atOrAfter.blockTimestamp - beforeOrAt.blockTimestamp;
      let targetDelta = target - beforeOrAt.blockTimestamp;

      // For gas savings the resulting point is written to beforeAt
      beforeOrAt.tickCumulative +=
        ((atOrAfter.tickCumulative - beforeOrAt.tickCumulative) /
          timepointTimeDelta) *
        targetDelta;
      beforeOrAt.secondsPerLiquidityCumulative += uint160(
        (uint256(
          atOrAfter.secondsPerLiquidityCumulative -
            beforeOrAt.secondsPerLiquidityCumulative,
        ) *
          targetDelta) /
          timepointTimeDelta,
      );
      beforeOrAt.volatilityCumulative +=
        ((atOrAfter.volatilityCumulative - beforeOrAt.volatilityCumulative) /
          timepointTimeDelta) *
        targetDelta;
      beforeOrAt.volumePerLiquidityCumulative +=
        ((atOrAfter.volumePerLiquidityCumulative -
          beforeOrAt.volumePerLiquidityCumulative) /
          timepointTimeDelta) *
        targetDelta;
    }

    // we're at the left boundary or at the middle
    return beforeOrAt;
  }

  /// @notice Returns the accumulator values as of each time seconds ago from the given time in the array of `secondsAgos`
  /// @dev Reverts if `secondsAgos` > oldest timepoint
  /// @param self The stored dataStorage array
  /// @param time The current block.timestamp
  /// @param secondsAgos Each amount of time to look back, in seconds, at which point to return an timepoint
  /// @param tick The current tick
  /// @param index The index of the timepoint that was most recently written to the timepoints array
  /// @param liquidity The current in-range pool liquidity
  /// @return tickCumulatives The tick * time elapsed since the pool was first initialized, as of each `secondsAgo`
  /// @return secondsPerLiquidityCumulatives The cumulative seconds / max(1, liquidity) since the pool was first initialized, as of each `secondsAgo`
  /// @return volatilityCumulatives The cumulative volatility values since the pool was first initialized, as of each `secondsAgo`
  /// @return volumePerAvgLiquiditys The cumulative volume per liquidity values since the pool was first initialized, as of each `secondsAgo`
  static getTimepoints(
    self: Record<number, Timepoint>,
    time: bigint,
    secondsAgos: bigint[],
    tick: bigint,
    index: bigint,
    liquidity: bigint,
  ): [bigint[], bigint[], bigint[], bigint[]] {
    let tickCumulatives = new Array<bigint>(secondsAgos.length);
    let secondsPerLiquidityCumulatives = new Array<bigint>(secondsAgos.length);
    let volatilityCumulatives = new Array<bigint>(secondsAgos.length);
    let volumePerAvgLiquiditys = new Array<bigint>(secondsAgos.length);

    let oldestIndex;
    // check if we have overflow in the past
    let nextIndex = index + 1n; // considering overflow
    if (self[Number(nextIndex)].initialized) {
      oldestIndex = nextIndex;
    }

    assert(oldestIndex); // FIXME ?

    let current: Timepoint;
    for (let i = 0; i < secondsAgos.length; i++) {
      current = this.getSingleTimepoint(
        self,
        time,
        secondsAgos[i],
        tick,
        index,
        oldestIndex,
        liquidity,
      );
      [
        tickCumulatives[i],
        secondsPerLiquidityCumulatives[i],
        volatilityCumulatives[i],
        volumePerAvgLiquiditys[i],
      ] = [
        current.tickCumulative,
        current.secondsPerLiquidityCumulative,
        current.volatilityCumulative,
        current.volumePerLiquidityCumulative,
      ];
    }

    return [
      tickCumulatives,
      secondsPerLiquidityCumulatives,
      volatilityCumulatives,
      volumePerAvgLiquiditys,
    ];
  }

  /// @notice Returns average volatility in the range from time-WINDOW to time
  /// @param self The stored dataStorage array
  /// @param time The current block.timestamp
  /// @param tick The current tick
  /// @param index The index of the timepoint that was most recently written to the timepoints array
  /// @param liquidity The current in-range pool liquidity
  /// @return volatilityAverage The average volatility in the recent range
  /// @return volumePerLiqAverage The average volume per liquidity in the recent range
  static getAverages(
    self: Record<number, Timepoint>,
    time: bigint,
    tick: bigint,
    index: bigint,
    liquidity: bigint,
  ): [bigint, bigint] {
    let oldestIndex;

    let oldest = self[0];
    let nextIndex = index + 1n; // considering overflow
    if (self[Number(nextIndex)].initialized) {
      oldest = self[Number(nextIndex)];
      oldestIndex = nextIndex;
    }

    assert(oldestIndex); // FIXME ?

    let endOfWindow = this.getSingleTimepoint(
      self,
      time,
      0n,
      tick,
      index,
      oldestIndex,
      liquidity,
    );

    let oldestTimestamp = oldest.blockTimestamp;
    if (this.lteConsideringOverflow(oldestTimestamp, time - WINDOW, time)) {
      let startOfWindow = this.getSingleTimepoint(
        self,
        time,
        WINDOW,
        tick,
        index,
        oldestIndex,
        liquidity,
      );
      return [
        (endOfWindow.volatilityCumulative -
          startOfWindow.volatilityCumulative) /
          WINDOW,
        uint256(
          endOfWindow.volumePerLiquidityCumulative -
            startOfWindow.volumePerLiquidityCumulative,
        ) >> 57n,
      ];
    } else if (time != oldestTimestamp) {
      let _oldestVolatilityCumulative = oldest.volatilityCumulative;
      let _oldestVolumePerLiquidityCumulative =
        oldest.volumePerLiquidityCumulative;
      return [
        (endOfWindow.volatilityCumulative - _oldestVolatilityCumulative) /
          (time - oldestTimestamp),
        uint256(
          endOfWindow.volumePerLiquidityCumulative -
            _oldestVolumePerLiquidityCumulative,
        ) >> 57n,
      ];
    }

    return [0n, 0n]; // should not enter here ?
  }

  /// @notice Initialize the dataStorage array by writing the first slot. Called once for the lifecycle of the timepoints array
  /// @param self The stored dataStorage array
  /// @param time The time of the dataStorage initialization, via block.timestamp truncated to uint32
  /// @param tick Initial tick
  //   static initialize(
  //     Timepoint[UINT16_MODULO] storage self,
  //     uint32 time,
  //     int24 tick
  //   ) internal {
  //     require(!self[0].initialized);
  //     self[0].initialized = true;
  //     self[0].blockTimestamp = time;
  //     self[0].averageTick = tick;
  //   }

  /// @notice Writes an dataStorage timepoint to the array
  /// @dev Writable at most once per block. Index represents the most recently written element. index must be tracked externally.
  /// @param self The stored dataStorage array
  /// @param index The index of the timepoint that was most recently written to the timepoints array
  /// @param blockTimestamp The timestamp of the new timepoint
  /// @param tick The active tick at the time of the new timepoint
  /// @param liquidity The total in-range liquidity at the time of the new timepoint
  /// @param volumePerLiquidity The gmean(volumes)/liquidity at the time of the new timepoint
  /// @return indexUpdated The new index of the most recently written element in the dataStorage array
  static write(
    self: Record<number, Timepoint>,
    index: bigint,
    blockTimestamp: bigint,
    tick: bigint,
    liquidity: bigint,
    volumePerLiquidity: bigint,
  ): bigint {
    let _last: Timepoint = self[Number(index)];
    // early return if we've already written an timepoint this block
    if (_last.blockTimestamp == blockTimestamp) {
      return index;
    }
    let last = _last;

    // get next index considering overflow
    let indexUpdated = index + 1n;

    let oldestIndex;
    // check if we have overflow in the past
    if (self[Number(indexUpdated)].initialized) {
      oldestIndex = indexUpdated;
    }

    assert(oldestIndex); // FIXME ?

    let avgTick = int24(
      this._getAverageTick(
        self,
        blockTimestamp,
        tick,
        index,
        oldestIndex,
        last.blockTimestamp,
        last.tickCumulative,
      ),
    );
    let prevTick = tick;
    if (index != oldestIndex) {
      let _prevLast = self[Number(index - 1n)]; // considering index underflow
      let _prevLastBlockTimestamp = _prevLast.blockTimestamp;
      let _prevLastTickCumulative = _prevLast.tickCumulative;
      prevTick = int24(
        (last.tickCumulative - _prevLastTickCumulative) /
          (last.blockTimestamp - _prevLastBlockTimestamp),
      );
    }

    self[Number(indexUpdated)] = this.createNewTimepoint(
      last,
      blockTimestamp,
      tick,
      prevTick,
      liquidity,
      avgTick,
      volumePerLiquidity,
    );

    return indexUpdated;
  }
}
