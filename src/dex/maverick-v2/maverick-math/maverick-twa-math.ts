import { BI_POWS } from '../../../bigint-constants';
import { _require } from '../../../utils';
import { PoolState } from '../types';
import { MaverickBasicMath } from './maverick-basic-math';

export class TwaMath {
  static updateValue(
    self: PoolState,
    value: bigint,
    lookback: bigint,
    timestamp: bigint,
  ) {
    if (timestamp === self.lastTimestamp) return;
    self.lastTwaD8 = this.getTwa(self, lookback, timestamp);
    self.lastTimestamp = timestamp;
    self.lastLogPriceD8 = value;
  }

  static floor(self: PoolState) {
    return MaverickBasicMath.floorD8Unchecked(self.lastTwaD8);
  }

  static getTwa(self: PoolState, lookback: bigint, timestamp: bigint): bigint {
    let timeDiff = timestamp - self.lastTimestamp;
    timeDiff = MaverickBasicMath.min(lookback, timeDiff);
    if (timeDiff === 0n) return self.lastTwaD8;

    let absValueDeviation = MaverickBasicMath.min(
      BI_POWS[8],
      MaverickBasicMath.abs(self.lastLogPriceD8 - self.lastTwaD8),
    );

    if (absValueDeviation === 0n) return self.lastTwaD8;
    let twaDeviation = MaverickBasicMath.mulDivDown(
      absValueDeviation,
      timeDiff,
      lookback,
    );

    return self.lastTwaD8 > self.lastLogPriceD8
      ? -twaDeviation + self.lastTwaD8
      : twaDeviation + self.lastTwaD8;
  }

  static getTwaFloor(
    self: PoolState,
    lookback: bigint,
    timestamp: bigint,
  ): bigint {
    return MaverickBasicMath.floorD8Unchecked(
      this.getTwa(self, lookback, timestamp),
    );
  }
}
