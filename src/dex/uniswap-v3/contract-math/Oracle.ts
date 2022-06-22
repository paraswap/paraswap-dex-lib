import {
  OracleObservation,
  OracleObservationCandidates,
  PoolState,
} from '../types';
import { _require } from '../../../utils';
import { DeepReadonly } from 'ts-essentials';
import { ZERO_ORACLE_OBSERVATION } from '../constants';

function replaceUndefinedObservationWithZero(state: PoolState, index: number) {
  if (state.observations[index] === undefined) {
    state.observations[index] = { ...ZERO_ORACLE_OBSERVATION };
  }
}

export class Oracle {
  static transform(
    state: DeepReadonly<PoolState>,
    last: OracleObservation,
    blockTimestamp: bigint,
    tick: bigint,
    liquidity: bigint,
  ): OracleObservation {
    const delta = blockTimestamp - last.blockTimestamp;
    return {
      blockTimestamp: state.blockTimestamp,
      tickCumulative: last.tickCumulative + BigInt.asIntN(56, tick) * delta,
      secondsPerLiquidityCumulativeX128:
        last.secondsPerLiquidityCumulativeX128 +
        (BigInt.asUintN(160, delta) << 128n) /
          (liquidity > 0n ? liquidity : 1n),
      initialized: true,
    };
  }

  static write(
    state: PoolState,
    index: number,
    blockTimestamp: bigint,
    tick: bigint,
    liquidity: bigint,
    cardinality: number,
    cardinalityNext: number,
  ): [number, number] {
    replaceUndefinedObservationWithZero(state, index);
    const last = state.observations[index];

    if (last.blockTimestamp == state.blockTimestamp)
      return [index, cardinality];

    let indexUpdated = 0;
    let cardinalityUpdated = 0;

    if (cardinalityNext > cardinality && index == cardinality - 1) {
      cardinalityUpdated = cardinalityNext;
    } else {
      cardinalityUpdated = cardinality;
    }

    indexUpdated = (index + 1) % cardinalityUpdated;

    state.observations[indexUpdated] = Oracle.transform(
      state,
      last,
      blockTimestamp,
      tick,
      liquidity,
    );

    delete state.observations[index];
    return [indexUpdated, cardinalityUpdated];
  }

  static lte(time: bigint, a: bigint, b: bigint): boolean {
    if (a <= time && b <= time) return a <= b;

    const aAdjusted = a > time ? a : a + 2n ** 32n;
    const bAdjusted = b > time ? b : b + 2n ** 32n;
    return aAdjusted <= bAdjusted;
  }

  static binarySearch(
    state: DeepReadonly<PoolState>,
    time: bigint,
    target: bigint,
    index: number,
    cardinality: number,
  ): OracleObservationCandidates {
    let l = (index + 1) % cardinality;
    let r = l + cardinality - 1;
    let i;

    let beforeOrAt;
    let atOrAfter;
    while (true) {
      i = (l + r) / 2;

      beforeOrAt = state.observations[i % cardinality];

      // we've landed on an uninitialized tick, keep searching higher (more recently)
      if (!beforeOrAt.initialized) {
        l = i + 1;
        continue;
      }

      atOrAfter = state.observations[(i + 1) % cardinality];

      const targetAtOrAfter = Oracle.lte(
        time,
        beforeOrAt.blockTimestamp,
        target,
      );

      // check if we've found the answer!
      if (targetAtOrAfter && Oracle.lte(time, target, atOrAfter.blockTimestamp))
        break;

      if (!targetAtOrAfter) r = i - 1;
      else l = i + 1;
    }
    return { beforeOrAt, atOrAfter };
  }

  static getSurroundingObservations(
    state: DeepReadonly<PoolState>,
    time: bigint,
    target: bigint,
    tick: bigint,
    index: number,
    liquidity: bigint,
    cardinality: number,
  ): OracleObservationCandidates {
    let beforeOrAt = state.observations[index];

    if (Oracle.lte(time, beforeOrAt.blockTimestamp, target)) {
      if (beforeOrAt.blockTimestamp === target) {
        return { beforeOrAt, atOrAfter: beforeOrAt };
      } else {
        return {
          beforeOrAt,
          atOrAfter: Oracle.transform(
            state,
            beforeOrAt,
            target,
            tick,
            liquidity,
          ),
        };
      }
    }

    beforeOrAt = state.observations[(index + 1) % cardinality];
    if (!beforeOrAt.initialized) beforeOrAt = state.observations[0];

    _require(
      Oracle.lte(time, beforeOrAt.blockTimestamp, target),
      'OLD',
      { time, beforeOrAtBlockTimestamp: beforeOrAt.blockTimestamp, target },
      'Oracle.lte(time, beforeOrAt.blockTimestamp, target)',
    );

    return Oracle.binarySearch(state, time, target, index, cardinality);
  }

  static observeSingle(
    state: DeepReadonly<PoolState>,
    time: bigint,
    secondsAgo: bigint,
    tick: bigint,
    index: number,
    liquidity: bigint,
    cardinality: number,
  ): [bigint, bigint] {
    if (secondsAgo == 0n) {
      let last = state.observations[index];
      if (last.blockTimestamp != time)
        last = Oracle.transform(state, last, time, tick, liquidity);
      return [last.tickCumulative, last.secondsPerLiquidityCumulativeX128];
    }

    const target = time - secondsAgo;

    const { beforeOrAt, atOrAfter } = Oracle.getSurroundingObservations(
      state,
      time,
      target,
      tick,
      index,
      liquidity,
      cardinality,
    );

    if (target === beforeOrAt.blockTimestamp) {
      return [
        beforeOrAt.tickCumulative,
        beforeOrAt.secondsPerLiquidityCumulativeX128,
      ];
    } else if (target === atOrAfter.blockTimestamp) {
      return [
        atOrAfter.tickCumulative,
        atOrAfter.secondsPerLiquidityCumulativeX128,
      ];
    } else {
      const observationTimeDelta =
        atOrAfter.blockTimestamp - beforeOrAt.blockTimestamp;
      const targetDelta = target - beforeOrAt.blockTimestamp;
      return [
        beforeOrAt.tickCumulative +
          ((atOrAfter.tickCumulative - beforeOrAt.tickCumulative) /
            observationTimeDelta) *
            targetDelta,
        beforeOrAt.secondsPerLiquidityCumulativeX128 +
          BigInt.asUintN(
            160,
            (BigInt.asUintN(
              256,
              atOrAfter.secondsPerLiquidityCumulativeX128 -
                beforeOrAt.secondsPerLiquidityCumulativeX128,
            ) *
              targetDelta) /
              observationTimeDelta,
          ),
      ];
    }
  }
}
