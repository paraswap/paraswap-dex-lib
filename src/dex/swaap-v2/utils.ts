import { Address } from '../../types';
import { CACHE_PREFIX, ETHER_ADDRESS, NULL_ADDRESS } from '../../constants';

export const getIdentifierPrefix = (
  dexKey: string,
  tokenA: Address,
  tokenB: Address,
) => {
  return `${dexKey}_${getPairName(tokenA, tokenB)}`.toLowerCase();
};

export const getPairName = (tokenA: Address, tokenB: Address) => {
  const sortedAddresses = tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA];
  return `${sortedAddresses[0]}_${sortedAddresses[1]}`.toLowerCase();
};

export const getPoolIdentifier = (
  dexKey: string,
  tokenA: Address,
  tokenB: Address,
) => {
  return `${getIdentifierPrefix(dexKey, tokenA, tokenB)}`.toLowerCase();
};

export const normalizeTokenAddress = (address: string): string => {
  return address.toLowerCase() === ETHER_ADDRESS.toLowerCase()
    ? NULL_ADDRESS
    : address.toLowerCase();
};
