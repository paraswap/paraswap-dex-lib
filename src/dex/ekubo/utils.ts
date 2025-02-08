import { hexlify } from 'ethers/lib/utils';
import { Token } from '../../types';
import { isETHAddress } from '../../utils';

export const NATIVE_TOKEN_ADDRESS = 0x0000000000000000000000000000eeeeee000000n;
export const ORACLE_TOKEN_ADDRESS = 0x04c46e830bb56ce22735d5d8fc9cb90309317d0fn;

export function convertToEkuboETHAddress(address: string): bigint {
  return isETHAddress(address) ? NATIVE_TOKEN_ADDRESS : BigInt(address);
}

export function sortAndConvertTokens(
  tokenA: Token,
  tokenB: Token,
): [bigint, bigint] {
  const [_a, _b] = [
    convertToEkuboETHAddress(tokenA.address),
    convertToEkuboETHAddress(tokenB.address),
  ];
  return _a > _b ? [_b, _a] : [_a, _b];
}

export function hexStringTokenPair(token0: bigint, token1: bigint): string {
  return `${hexlify(token0)}/${hexlify(token1)}`;
}
