import { BigNumber, BytesLike, ethers } from 'ethers';
import { extractSuccessAndValue, generalDecoder } from '../../lib/decoders';
import { MultiResult } from '../../lib/multi-wrapper';
import { DexConfigMap } from '../../types';
import { bigIntify } from '../../utils';
import { DexParams, StateMultiCallResultWithRelativeBitmaps } from './types';

export function getUniswapV3DexKey(UniswapV3Config: DexConfigMap<DexParams>) {
  const UniswapV3Keys = Object.keys(UniswapV3Config);
  if (UniswapV3Keys.length !== 1) {
    throw new Error(
      `UniswapV3 key in UniswapV3Config is not unique. Update relevant places (optimizer) or fix config issue. Received: ${JSON.stringify(
        UniswapV3Config,
        (_0, value) => (typeof value === 'bigint' ? value.toString() : value),
      )}`,
    );
  }

  return UniswapV3Keys[0].toLowerCase();
}

export function setImmediatePromise() {
  return new Promise<void>(resolve => {
    setImmediate(() => {
      resolve();
    });
  });
}

export function decodeStateMultiCallResultWithRelativeBitmaps(
  result: MultiResult<BytesLike> | BytesLike,
): StateMultiCallResultWithRelativeBitmaps {
  const [isSuccess, toDecode] = extractSuccessAndValue(result);

  if (!isSuccess || toDecode === '0x') {
    throw new Error(
      `decodeStateMultiCallResultWithRelativeBitmaps failed to get decodable result: ${result}`,
    );
  }

  const decoded = ethers.utils.defaultAbiCoder.decode(
    [
      // I don't want to pass here any interface, so I just use it in ethers format
      `
      tuple(
        address pool,
        uint256 blockTimestamp,
        tuple(
          uint160 sqrtPriceX96;
          int24 tick;
          uint16 observationIndex;
          uint16 observationCardinality;
          uint16 observationCardinalityNext;
          uint8 feeProtocol;
          bool unlocked;
        ) slot0,
        uint128 liquidity,
        int24 tickSpacing,
        uint128 maxLiquidityPerTick,
        tuple(
          uint32 blockTimestamp,
          int56 tickCumulative,
          uint160 secondsPerLiquidityCumulativeX128,
          bool initialized,
        ) observation,
        tuple(
          int16 index;
          uint256 value;
        )[] tickBitmap,
        tuple(
          int24 index,
          TickInfo value
        )[] ticks
      )
    `,
    ],
    toDecode,
  )[0];

  return {
    pool: decoded.pool,
    blockTimestamp: bigIntify(decoded.blockTimestamp),
    slot0: {
      sqrtPriceX96: bigIntify(decoded.slot0.sqrtPriceX96),
      tick: bigIntify(decoded.slot0.tick),
      observationIndex: parseInt(decoded.slot0.observationIndex, 10),
      observationCardinality: parseInt(decoded.slot0.sqrtPriceX96, 10),
      observationCardinalityNext: parseInt(decoded.slot0.sqrtPriceX96, 10),
      feeProtocol: bigIntify(decoded.slot0.feeProtocol),
    },
    liquidity: bigIntify(decoded.liquidity),
    tickSpacing: bigIntify(decoded.tickSpacing),
    maxLiquidityPerTick: bigIntify(decoded.maxLiquidityPerTick),
    observation: {
      blockTimestamp: bigIntify(decoded.observation.blockTimestamp),
      tickCumulative: bigIntify(decoded.observation.tickCumulative),
      secondsPerLiquidityCumulativeX128: bigIntify(
        decoded.observation.secondsPerLiquidityCumulativeX128,
      ),
      initialized: !!decoded.observation.initialized,
    },
    tickBitmap: decoded.tickBitmap.map(
      (_decoded: { index: number; value: BigNumber }) => ({
        index: _decoded.index,
        value: bigIntify(_decoded.value),
      }),
    ),
    ticks: decoded.ticks.map(
      (_decoded: { index: number; value: BigNumber }) => ({
        index: _decoded,
        value: bigIntify(_decoded.value),
      }),
    ),
  };
}
