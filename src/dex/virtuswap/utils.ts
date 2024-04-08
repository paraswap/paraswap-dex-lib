import { MultiResult } from '../../lib/multi-wrapper';
import { BytesLike, defaultAbiCoder } from 'ethers/lib/utils';
import {
  addressDecode,
  booleanDecode,
  extractSuccessAndValue,
  generalDecoder,
} from '../../lib/decoders';
import { parseInt } from 'lodash';

class AbiCoderResultParser<TResult> {
  constructor(
    readonly decoderFactory: (
      type?: string,
    ) => (val: MultiResult<BytesLike> | BytesLike) => TResult,
  ) {}

  create<TName extends string>(name: TName, type: string) {
    return {
      name,
      type,
      decodeFunction: this.decoderFactory(type),
    } as const;
  }
}

export const abiCoderParsers = {
  Address: new AbiCoderResultParser(() => addressDecode),

  BigInt: new AbiCoderResultParser(
    (type?: string) =>
      (result: MultiResult<BytesLike> | BytesLike): bigint =>
        generalDecoder(result, [type ?? 'uint256'], 0n, value =>
          value[0].toBigInt(),
        ),
  ),

  Int: new AbiCoderResultParser(
    (type?: string) =>
      (result: MultiResult<BytesLike> | BytesLike): number => {
        const [isSuccess, toDecode] = extractSuccessAndValue(result);
        if (!isSuccess) return 0;
        return parseInt(
          defaultAbiCoder.decode([type ?? 'uint256'], toDecode)[0],
          10,
        );
      },
  ),

  Bool: new AbiCoderResultParser(() => booleanDecode),
} as const;
