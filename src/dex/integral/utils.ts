import { BytesLike, ethers } from 'ethers';
import { MultiResult } from '../../lib/multi-wrapper';
import { extractSuccessAndValue, generalDecoder } from '../../lib/decoders';
import { assert } from 'ts-essentials';
import { Observation } from './types';
import { Address } from '@paraswap/core';

export const uint32ToNumber = (
  result: MultiResult<BytesLike> | BytesLike,
): number => {
  return generalDecoder(result, ['uint32'], 0, value =>
    parseInt(value[0].toString(), 10),
  );
};

export function ceil_div(a: bigint, b: bigint) {
  const c = a / b;
  if (a != b * c) {
    return c + 1n;
  } else {
    return c;
  }
}

export function sortTokens(srcAddress: Address, destAddress: Address) {
  return [srcAddress, destAddress].sort((a, b) => (a < b ? -1 : 1));
}

export function decodeStateMultiCallResultWithObservation(
  result: MultiResult<BytesLike> | BytesLike,
): Observation {
  const [isSuccess, toDecode] = extractSuccessAndValue(result);

  assert(
    isSuccess && toDecode !== '0x',
    `decodeStateMultiCallResultWithRelativeBitmaps failed to get decodable result: ${result}`,
  );

  const decoded = ethers.utils.defaultAbiCoder.decode(
    [
      `
      tuple(
        uint32 blockTimestamp,
        int56 tickCumulative,
        uint160 secondsPerLiquidityCumulativeX128,
        bool initialized,
      )
    `,
    ],
    toDecode,
  )[0];
  return decoded as Observation;
}
