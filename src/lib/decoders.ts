import { Result } from '@ethersproject/abi';
import BigNumber from 'bignumber.js';
import { BytesLike, defaultAbiCoder } from 'ethers/lib/utils';
import { parseInt } from 'lodash';
import { BN_0 } from '../bignumber-constants';
import { NULL_ADDRESS } from '../constants';
import { MultiResult } from './multi-wrapper';

export function generalDecoder<T>(
  result: MultiResult<BytesLike>,
  types: string[],
  defaultValue: T,
  parser?: (v: Result) => T,
): T {
  if (!result.success || result.returnData === '0x') {
    return defaultValue;
  }
  const decoded = defaultAbiCoder.decode(types, result.returnData);
  return parser ? parser(decoded) : decoded[0];
}

export const uint256ToBigInt = (result: MultiResult<string>): bigint => {
  if (!result.success) {
    return 0n;
  }
  return BigInt(defaultAbiCoder.decode(['uint256'], result.returnData)[0]);
};

export const uint256ArrayDecode = (result: MultiResult<string>): bigint => {
  if (!result.success) {
    return 0n;
  }
  return defaultAbiCoder
    .decode(['uint256[]'], result.returnData)[0]
    .map((r: any) => BigInt(r.toString()));
};

export const uin256DecodeToBigNumber = (
  result: MultiResult<string>,
): BigNumber => {
  if (!result.success) {
    return BN_0;
  }
  return new BigNumber(
    defaultAbiCoder.decode(['uint256'], result.returnData)[0].toString(),
  );
};

export const uint256DecodeToNumber = (result: MultiResult<string>): number => {
  if (!result.success) {
    return 0;
  }
  return parseInt(
    defaultAbiCoder.decode(['uint256'], result.returnData)[0],
    10,
  );
};

export const uin256DecodeToFloat = (result: MultiResult<string>): number => {
  if (!result.success) {
    return 0;
  }
  return parseFloat(defaultAbiCoder.decode(['uint256'], result.returnData)[0]);
};

export const uin128DecodeToFloat = (result: MultiResult<string>): number => {
  if (!result.success) {
    return 0;
  }
  return parseFloat(defaultAbiCoder.decode(['uint128'], result.returnData)[0]);
};

export const uin128DecodeToInt = (result: MultiResult<string>): number => {
  if (!result.success) {
    return 0;
  }
  return parseInt(
    defaultAbiCoder.decode(['uint128'], result.returnData)[0],
    10,
  );
};

export const booleanDecode = (result: MultiResult<string>): boolean => {
  if (!result.success) {
    return false;
  }
  return defaultAbiCoder.decode(['bool'], result.returnData)[0];
};

export const addressDecode = (result: MultiResult<string>): string => {
  return generalDecoder(result, ['address'], NULL_ADDRESS, v =>
    v[0].toLowerCase(),
  );
};

export const bytes32ToString = (result: MultiResult<BytesLike>): string => {
  return generalDecoder(result, ['bytes32'], '', value =>
    value[0].toLowerCase(),
  );
};

export const uint8ToNumber = (result: MultiResult<BytesLike>): number => {
  return generalDecoder(result, ['uint8'], 0, value =>
    parseInt(value[0].toString(), 10),
  );
};

export const uint24ToNumber = (result: MultiResult<BytesLike>): number => {
  return generalDecoder(result, ['uint24'], 0, value =>
    parseInt(value[0].toString(), 10),
  );
};

export const uint24ToBigInt = (result: MultiResult<BytesLike>): bigint => {
  return generalDecoder(result, ['uint24'], 0n, value =>
    BigInt(value[0].toString()),
  );
};
