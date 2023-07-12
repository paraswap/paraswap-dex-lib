import { assert } from 'ts-essentials';
import { PoolState } from '../types';
import { DataStorage, TIMEPOINT_ZERO } from './DataStorage';
import { BI_MAX_UINT256 } from '../../../bigint-constants';
import { uint128 } from '../../../utils';
import { Sqrt } from './Sqrt';

// TO COMPARE WITH https://github.com/cryptoalgebra/Algebra/blob/3cd9a65bb5bb39d26fb4346e8f7d6d2a28672cc6/src/core/contracts/DataStorageOperator.sol#L16-L17

const MAX_VOLUME_PER_LIQUIDITY = 100000 << 64; // maximum meaningful ratio of volume to liquidity

export class DataStorageOperator {
  /// @inheritdoc IDataStorageOperator
  static getSingleTimepoint(
    state: PoolState,
    time: bigint,
    secondsAgo: bigint,
    tick: bigint,
    index: bigint,
    liquidity: bigint,
  ): [bigint, bigint, bigint, bigint] {
    let oldestIndex;
    // check if we have overflow in the past
    let nextIndex = index + 1n; // considering overflow
    if ((state.timepoints[Number(nextIndex)] || TIMEPOINT_ZERO).initialized) {
      oldestIndex = nextIndex;
    }

    assert(oldestIndex); //

    let result = DataStorage.getSingleTimepoint(
      state.timepoints,
      time,
      secondsAgo,
      tick,
      index,
      oldestIndex,
      liquidity,
    );
    let [
      tickCumulative,
      secondsPerLiquidityCumulative,
      volatilityCumulative,
      volumePerAvgLiquidity,
    ] = [
      result.tickCumulative,
      result.secondsPerLiquidityCumulative,
      result.volatilityCumulative,
      result.volumePerLiquidityCumulative,
    ];

    return [
      tickCumulative,
      secondsPerLiquidityCumulative,
      volatilityCumulative,
      volumePerAvgLiquidity,
    ];
  }

  /// @inheritdoc IDataStorageOperator
  static getTimepoints(
    state: PoolState,
    time: bigint,
    secondsAgos: bigint[],
    tick: bigint,
    index: bigint,
    liquidity: bigint,
  ): [bigint[], bigint[], bigint[], bigint[]] {
    return DataStorage.getTimepoints(
      state.timepoints,
      time,
      secondsAgos,
      tick,
      index,
      liquidity,
    );
  }

  /// @inheritdoc IDataStorageOperator
  static getAverages(
    state: PoolState,
    time: bigint,
    tick: bigint,
    index: bigint,
    liquidity: bigint,
  ): [bigint, bigint] {
    return DataStorage.getAverages(
      state.timepoints,
      time,
      tick,
      index,
      liquidity,
    );
  }

  /// @inheritdoc IDataStorageOperator
  static write(
    state: PoolState,
    index: bigint,
    blockTimestamp: bigint,
    tick: bigint,
    liquidity: bigint,
    volumePerLiquidity: bigint,
  ): bigint {
    return DataStorage.write(
      state.timepoints,
      index,
      blockTimestamp,
      tick,
      liquidity,
      volumePerLiquidity,
    );
  }

  /// @inheritdoc IDataStorageOperator
  static calculateVolumePerLiquidity(
    liquidity: bigint,
    amount0: bigint,
    amount1: bigint,
  ): bigint {
    let volume = Sqrt.sqrtAbs(amount0) * Sqrt.sqrtAbs(amount1);
    let volumeShifted;
    if (volume >= 2n ** 192n)
      volumeShifted = BI_MAX_UINT256 / (liquidity > 0n ? liquidity : 1n);
    else volumeShifted = (volume << 64n) / (liquidity > 0n ? liquidity : 1n);
    if (volumeShifted >= MAX_VOLUME_PER_LIQUIDITY)
      return BigInt(MAX_VOLUME_PER_LIQUIDITY);
    else return uint128(volumeShifted);
  }

  /// @inheritdoc IDataStorageOperator
  static window(): bigint {
    return DataStorage.WINDOW;
  }

  // /// @inheritdoc IDataStorageOperator
  // static getFee(
  //   uint32 _time,
  //   int24 _tick,
  //   uint16 _index,
  //   uint128 _liquidity
  // ) external view override onlyPool returns (uint16 fee) {
  //   (uint88 volatilityAverage, uint256 volumePerLiqAverage) = timepoints.getAverages(_time, _tick, _index, _liquidity);

  //   return AdaptiveFee.getFee(volatilityAverage / 15, volumePerLiqAverage, feeConfig);
  // }
}
