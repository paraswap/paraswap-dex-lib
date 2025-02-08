import { hexlify, hexZeroPad } from 'ethers/lib/utils';
import { Token } from '../../types';
import { isETHAddress } from '../../utils';
import { ETHER_ADDRESS } from '../../constants';

export const NATIVE_TOKEN_ADDRESS = 0x0000000000000000000000000000eeeeee000000n;
export const ORACLE_TOKEN_ADDRESS = 0x04c46e830bb56ce22735d5d8fc9cb90309317d0fn;

export function convertParaSwapToEkubo(address: string): bigint {
  return isETHAddress(address) ? NATIVE_TOKEN_ADDRESS : BigInt(address);
}

export function convertEkuboToParaSwap(address: bigint): string {
  return address === NATIVE_TOKEN_ADDRESS
    ? ETHER_ADDRESS
    : hexZeroPad(hexlify(address), 20);
}

export function sortAndConvertTokens(
  tokenA: Token,
  tokenB: Token,
): [bigint, bigint] {
  const [a, b] = [
    convertParaSwapToEkubo(tokenA.address),
    convertParaSwapToEkubo(tokenB.address),
  ];
  return a > b ? [b, a] : [a, b];
}

export function hexStringTokenPair(token0: bigint, token1: bigint): string {
  return `${hexlify(token0)}/${hexlify(token1)}`;
}
