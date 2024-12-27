import { BytesLike } from 'ethers';
import { MultiResult } from '../../lib/multi-wrapper';
import { generalDecoder } from '../../lib/decoders';

export const decodeAmountOut = (
  result: MultiResult<BytesLike> | BytesLike,
): [bigint, bigint] => {
  const decoded = generalDecoder(
    result,
    ['uint256', 'uint256'],
    [0n, 0n],
    value => [value[0].toBigInt(), value[1].toBigInt()],
  );
  return decoded as [bigint, bigint];
};
