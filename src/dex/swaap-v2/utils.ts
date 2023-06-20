import { Address } from '../../types';
import { CACHE_PREFIX, ETHER_ADDRESS, NULL_ADDRESS } from '../../constants';

export const getIdentifierPrefix = (
  dexKey: string,
  srcAddress: Address,
  destAddress: Address,
) => {
  return `${dexKey}_${getPairName(srcAddress, destAddress)}`.toLowerCase();
};

export const getPairName = (srcAddress: Address, destAddress: Address) => {
  const sortedAddresses =
    srcAddress < destAddress
      ? [srcAddress, destAddress]
      : [destAddress, srcAddress];
  return `${sortedAddresses[0]}_${sortedAddresses[1]}`.toLowerCase();
};

export const getPoolIdentifier = (
  dexKey: string,
  srcAddress: Address,
  destAddress: Address,
) => {
  return `${getIdentifierPrefix(
    dexKey,
    srcAddress,
    destAddress,
  )}`.toLowerCase();
};

export const normalizeTokenAddress = (address: string): string => {
  return address.toLowerCase() === ETHER_ADDRESS.toLowerCase()
    ? NULL_ADDRESS
    : address.toLowerCase();
};
