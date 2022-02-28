import { getAddress } from '@ethersproject/address';

export const isSameAddress = (address1: string, address2: string): boolean =>
  getAddress(address1) === getAddress(address2);

export function getTokenScalingFactor(tokenDecimals: number): bigint {
  return BigInt(1e18) * BigInt(10) ** BigInt(18 - tokenDecimals);
}
