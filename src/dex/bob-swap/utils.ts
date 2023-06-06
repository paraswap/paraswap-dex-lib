import { MultiResult } from '../../lib/multi-wrapper';
import { BigNumber, BytesLike, ethers } from 'ethers';
import { DecodedCollateralState, DecodedCollateralStateLegacy } from './types';
import { extractSuccessAndValue } from '../../lib/decoders';
import { assert } from 'ts-essentials';
import { defaultValues } from './constants';

function decodeCollateralState<T>(
  result: MultiResult<BytesLike> | BytesLike,
  defaultValue: T,
  decodeString: string,
): T {
  const [isSuccess, toDecode] = extractSuccessAndValue(result);

  assert(
    isSuccess,
    `decodeCollateralStateResult failed to get decodable result: ${result}`,
  );

  if (toDecode === '0x') {
    return defaultValue;
  }

  const decoded = ethers.utils.defaultAbiCoder.decode(
    [decodeString],
    toDecode,
  )[0];
  return decoded as T;
}

export function decodeCollateralStateResult(
  result: MultiResult<BytesLike> | BytesLike,
): DecodedCollateralState {
  return decodeCollateralState<DecodedCollateralState>(
    result,
    {
      balance: BigNumber.from(0),
      buffer: BigNumber.from(0),
      dust: BigNumber.from(0),
      yield: '',
      price: BigNumber.from(0),
      inFee: BigNumber.from(0),
      outFee: BigNumber.from(0),
      maxBalance: BigNumber.from(0),
      maxInvested: BigNumber.from(0),
    },
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
  );
}

export function decodeCollateralStateLegacyResult(
  result: MultiResult<BytesLike> | BytesLike,
) {
  return decodeCollateralState<DecodedCollateralStateLegacy>(
    result,
    {
      balance: BigNumber.from(0),
      buffer: BigNumber.from(0),
      dust: BigNumber.from(0),
      yield: '',
      price: BigNumber.from(0),
      inFee: BigNumber.from(0),
      outFee: BigNumber.from(0),
    },
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
  );
}
