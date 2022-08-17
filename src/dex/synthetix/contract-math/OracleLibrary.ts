import { BI_MAX_UINT128 } from '../../../bigint-constants';
import { Address } from '../../../types';
import { _require } from '../../../utils';
import { PoolState } from '../types';
import { FullMath } from './FullMath';
import { TickMath } from './TickMath';

export class OracleLibrary {
  static getBlockStartingTick(state: PoolState, pool: Address): bigint {
    let { tick, observationIndex, observationCardinality } =
      state.dexPriceAggregator.uniswapV3Slot0[pool];

    // 2 observations are needed to reliably calculate the block starting tick
    _require(
      observationCardinality > 1n,
      'NEO',
      { observationCardinality },
      'observationCardinality > 1n',
    );

    // If the latest observation occurred in the past, then no tick-changing trades have happened in this block
    // therefore the tick in `slot0` is the same as at the beginning of the current block.
    // We don't need to check if this observation is initialized - it is guaranteed to be.
    const { blockTimestamp: observationTimestamp, tickCumulative } =
      state.dexPriceAggregator.uniswapV3Observations[pool][
        Number(observationIndex)
      ];

    if (observationTimestamp !== BigInt.asUintN(32, state.blockTimestamp)) {
      return tick;
    }

    const prevIndex =
      (BigInt.asUintN(256, observationIndex) + observationCardinality - 1n) %
      BigInt(observationCardinality);

    const {
      blockTimestamp: prevObservationTimestamp,
      tickCumulative: prevTickCumulative,
      initialized: prevInitialized,
    } = state.dexPriceAggregator.uniswapV3Observations[pool][Number(prevIndex)];

    _require(
      prevInitialized,
      'ONI',
      { prevInitialized, pool },
      'prevInitialized',
    );

    const delta = observationTimestamp - prevObservationTimestamp;
    tick = BigInt.asIntN(24, (tickCumulative - prevTickCumulative) / delta);
    return tick;
  }

  static consult(state: PoolState, pool: Address, secondsAgo: bigint): bigint {
    _require(
      secondsAgo !== 0n,
      'BP',
      { secondsAgo, pool },
      'secondsAgo !== 0n',
    );

    const tickCumulatives = state.dexPriceAggregator.tickCumulatives[pool];

    const tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];

    const arithmeticMeanTick = BigInt.asIntN(
      24,
      tickCumulativesDelta / secondsAgo,
    );
    return arithmeticMeanTick;
  }

  static getQuoteAtTick(
    tick: bigint,
    baseAmount: bigint,
    baseToken: Address,
    quoteToken: Address,
  ): bigint {
    const sqrtRatioX96 = TickMath.getSqrtRatioAtTick(tick);
    let quoteAmount = 0n;
    // Calculate quoteAmount with better precision if it doesn't overflow when multiplied by itself
    if (sqrtRatioX96 <= BI_MAX_UINT128) {
      const ratioX192 = BigInt.asUintN(256, sqrtRatioX96) * sqrtRatioX96;
      quoteAmount =
        baseToken < quoteToken
          ? FullMath.mulDiv(ratioX192, baseAmount, 1n << 192n)
          : FullMath.mulDiv(1n << 192n, baseAmount, ratioX192);
    } else {
      const ratioX128 = FullMath.mulDiv(sqrtRatioX96, sqrtRatioX96, 1n << 64n);
      quoteAmount =
        baseToken < quoteToken
          ? FullMath.mulDiv(ratioX128, baseAmount, 1n << 128n)
          : FullMath.mulDiv(1n << 128n, baseAmount, ratioX128);
    }
    return quoteAmount;
  }
}
