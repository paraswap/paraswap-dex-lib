import { MultiResult } from '../../lib/multi-wrapper';
import { BytesLike, ethers } from 'ethers';
import { DecodedCollateralState } from './types';
import { extractSuccessAndValue } from '../../lib/decoders';
import { assert } from 'ts-essentials';

export function decodeCollateralStateResult(
  result: MultiResult<BytesLike> | BytesLike,
): DecodedCollateralState {
  const [isSuccess, toDecode] = extractSuccessAndValue(result);

  assert(
    isSuccess && toDecode !== '0x',
    `decodeCollateralStateResult failed to get decodable result: ${result}`,
  );

  const decoded = ethers.utils.defaultAbiCoder.decode(
    [
      `
          tuple(
            uint128 balance,
            uint128 buffer,
            uint96 dust,
            address yield,
            uint128 price,
            uint64 inFee,
            uint64 outFee,
            uint256 maxBalance,
            uint256 maxInvested
          )
          `,
    ],
    toDecode,
  )[0];
  return decoded as DecodedCollateralState;
}
