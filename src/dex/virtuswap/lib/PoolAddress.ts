import { ethers } from 'ethers';
import { Address } from '../../../types';
import { normalizeAddress } from '../../../utils';

export function orderAddresses(
  tokenA: Address,
  tokenB: Address,
): [Address, Address] {
  return tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA];
}

export function getSalt(tokenA: Address, tokenB: Address): string {
  const [token0, token1] = orderAddresses(tokenA, tokenB);
  return ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ['address', 'address'],
      [token0, token1],
    ),
  );
}

export function computeAddress(
  factory: Address,
  token0: Address,
  token1: Address,
  initCodeHash: string,
): Address {
  const salt = getSalt(token0, token1);
  return normalizeAddress(
    ethers.utils.getCreate2Address(factory, salt, initCodeHash),
  );
}
