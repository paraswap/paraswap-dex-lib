import { BytesLike } from 'ethers';
import { generalDecoder } from '../../lib/decoders';
import { MultiResult } from '../../lib/multi-wrapper';
import { Address } from '@paraswap/core';

export function ceil_div(a: bigint, b: bigint) {
  const c = a / b;
  if (a != b * c) {
    return c + 1n;
  } else {
    return c;
  }
}

export const uint32ToNumber = (
  result: MultiResult<BytesLike> | BytesLike,
): number => {
  return generalDecoder(result, ['uint32'], 0, value =>
    parseInt(value[0].toString(), 10),
  );
};

export function sortTokens(srcAddress: Address, destAddress: Address) {
  return [srcAddress, destAddress].sort((a, b) => (a < b ? -1 : 1));
}
