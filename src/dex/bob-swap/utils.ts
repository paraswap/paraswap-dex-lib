import { MultiResult } from '../../lib/multi-wrapper';
import { BigNumber, BytesLike, ethers } from 'ethers';
import { DecodedCollateralState } from './types';
import { extractSuccessAndValue } from '../../lib/decoders';
import { assert } from 'ts-essentials';

export function decodeCollateralStateResult(
  result: MultiResult<BytesLike> | BytesLike,
): DecodedCollateralState {
  const [isSuccess, toDecode] = extractSuccessAndValue(result);

  assert(
    isSuccess,
    `decodeCollateralStateResult failed to get decodable result: ${result}`,
  );

  if (toDecode === '0x') {
    return {
      balance: BigNumber.from(0),
      buffer: BigNumber.from(0),
      dust: BigNumber.from(0),
      yield: '',
      price: BigNumber.from(0),
      inFee: BigNumber.from(0),
      outFee: BigNumber.from(0),
    };
  }

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
            uint64 outFee
          )
          `,
    ],
    toDecode,
  )[0];
  return decoded as DecodedCollateralState;
}
