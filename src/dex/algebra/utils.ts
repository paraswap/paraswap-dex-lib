import { BytesLike, ethers } from 'ethers';
import { assert } from 'ts-essentials';
import { extractSuccessAndValue } from '../../lib/decoders';
import { MultiResult } from '../../lib/multi-wrapper';
import { DecodedStateMultiCallResultWithRelativeBitmaps } from './types';

export function decodeStateMultiCallResultWithRelativeBitmaps(
  result: MultiResult<BytesLike> | BytesLike,
): DecodedStateMultiCallResultWithRelativeBitmaps {
  const [isSuccess, toDecode] = extractSuccessAndValue(result);

  assert(
    isSuccess && toDecode !== '0x',
    `decodeStateMultiCallResultWithRelativeBitmaps failed to get decodable result: ${result}`,
  );

  const decoded = ethers.utils.defaultAbiCoder.decode(
    [
      // I don't want to pass here any interface, so I just use it in ethers format
      `
        tuple(
          address pool,
          uint256 blockTimestamp,
          tuple(
            uint160 price,
            int24 tick,
            uint16 fee,
            uint16 timepointIndex,
            uint8 communityFeeToken0,
            uint8 communityFeeToken1,
            bool unlocked,
          ) globalState,
          uint128 liquidity,
          int24 tickSpacing,
          uint128 maxLiquidityPerTick,
          tuple(
            bool initialized,
            uint32 blockTimestamp,
            int56 tickCumulative,
            uint160 secondsPerLiquidityCumulative,
            uint88 volatilityCumulative,
            int24 averageTick,
            uint144 volumePerLiquidityCumulative,
          ) timepoints,
          tuple(
            int16 index,
            uint256 value,
          )[] tickBitmap,
          tuple(
            int24 index,
            tuple(
              uint128 liquidityGross,
              int128 liquidityNet,
              int56 tickCumulativeOutside,
              uint160 secondsPerLiquidityOutsideX128,
              uint32 secondsOutside,
              bool initialized,
            ) value,
          )[] ticks
        )
      `,
    ],
    toDecode,
  )[0];
  // This conversion is not precise, because when we decode, we have more values
  // But I typed only the ones that are used later
  return decoded as DecodedStateMultiCallResultWithRelativeBitmaps;
}
