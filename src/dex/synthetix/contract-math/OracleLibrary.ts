// import { Address } from '../../../types';
// import { _require } from '../../../utils';
// import { PoolState } from '../types';

// export class OracleLibrary {
//   static getBlockStartingTick(state: PoolState, pool: Address): bigint {
//     let { tick, observationIndex, observationCardinality } =
//       state.dexPriceAggregator.uniswapV3Slot0[pool];

//     // 2 observations are needed to reliably calculate the block starting tick
//     _require(
//       observationCardinality > 1n,
//       'NEO',
//       { observationCardinality },
//       'observationCardinality > 1n',
//     );

//     // If the latest observation occurred in the past, then no tick-changing trades have happened in this block
//     // therefore the tick in `slot0` is the same as at the beginning of the current block.
//     // We don't need to check if this observation is initialized - it is guaranteed to be.
//     const { blockTimestamp: observationTimestamp, tickCumulative } =
//       state.dexPriceAggregator.uniswapV3Observations[pool][
//         Number(observationIndex)
//       ];

//     if (observationTimestamp !== BigInt.asUintN(32, state.blockTimestamp)) {
//       return tick;
//     }

//     const prevIndex =
//       (BigInt.asUintN(256, observationIndex) + observationCardinality - 1n) %
//       BigInt(observationCardinality);

//     const {
//       blockTimestamp: prevObservationTimestamp,
//       tickCumulative: prevTickCumulative,
//       initialized: prevInitialized,
//     } = state.dexPriceAggregator.uniswapV3Observations[pool][Number(prevIndex)];

//     _require(
//       prevInitialized,
//       'ONI',
//       { prevInitialized, pool },
//       'prevInitialized',
//     );

//     const delta = observationTimestamp - prevObservationTimestamp;
//     tick = BigInt.asIntN(24, (tickCumulative - prevTickCumulative) / delta);
//     return tick;
//   }

//   static consult(pool: Address, secondsAgo: bigint): [bigint, bigint] {
//     _require(secondsAgo !== 0n, 'BP', {secondsAgo, pool}, 'secondsAgo !== 0n');

//         const secondsAgos = [secondsAgo, 1n];

//         (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s) =
//             IUniswapV3Pool(pool).observe(secondsAgos);

//         int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];
//         uint160 secondsPerLiquidityCumulativesDelta =
//             secondsPerLiquidityCumulativeX128s[1] - secondsPerLiquidityCumulativeX128s[0];

//         arithmeticMeanTick = int24(tickCumulativesDelta / secondsAgo);
//         // Always round to negative infinity
//         if (tickCumulativesDelta < 0 && (tickCumulativesDelta % secondsAgo != 0)) arithmeticMeanTick--;

//         // We are multiplying here instead of shifting to ensure that harmonicMeanLiquidity doesn't overflow uint128
//         uint192 secondsAgoX160 = uint192(secondsAgo) * type(uint160).max;
//         harmonicMeanLiquidity = uint128(secondsAgoX160 / (uint192(secondsPerLiquidityCumulativesDelta) << 32));
//   }

//   static getQuoteAtTick(
//     tick: bigint,
//     baseAmount: bigint,
//     baseToken: Address,
//     quoteToken: Address,
//   ): bigint {
//     const sqrtRatioX96 = TickMath.getSqrtRatioAtTick(tick);
//     let quoteAmount = 0n;
//     // Calculate quoteAmount with better precision if it doesn't overflow when multiplied by itself
//     if (sqrtRatioX96 <= type(uint128).max) {
//       const ratioX192 = uint256(sqrtRatioX96) * sqrtRatioX96;
//       quoteAmount =
//         baseToken < quoteToken
//           ? FullMath.mulDiv(ratioX192, baseAmount, 1 << 192)
//           : FullMath.mulDiv(1 << 192, baseAmount, ratioX192);
//     } else {
//       const ratioX128 = FullMath.mulDiv(sqrtRatioX96, sqrtRatioX96, 1 << 64);
//       quoteAmount =
//         baseToken < quoteToken
//           ? FullMath.mulDiv(ratioX128, baseAmount, 1 << 128)
//           : FullMath.mulDiv(1 << 128, baseAmount, ratioX128);
//     }
//     return quoteAmount;
//   }
// }
