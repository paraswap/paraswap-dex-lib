import { PoolState, Token as SORToken } from './types';
import { biginterify } from '../../utils';
import { Pool as OldPool } from '@balancer-labs/sor/dist/types';

export function typecastReadOnlyToken(readOnlyToken: any): SORToken {
  return {
    address: readOnlyToken.address,
    balance: biginterify(readOnlyToken.balance),
    decimals: readOnlyToken.decimals,
    denormWeight: biginterify(readOnlyToken.denormWeight),
  };
}

export function typecastReadOnlyPool(readOnlyPool: any): PoolState {
  return {
    id: readOnlyPool.id,
    swapFee: biginterify(readOnlyPool.swapFee),
    totalWeight: biginterify(readOnlyPool.totalWeight),
    tokens: readOnlyPool.tokens.map(typecastReadOnlyToken),
    tokensList: readOnlyPool.tokensList,
  };
}

export function mapFromOldPoolToPoolState(
  oldPools: (OldPool | null)[],
  pools: PoolState[],
): PoolState[] {
  const result = [];

  for (const oldPool of oldPools) {
    const poolState = pools.filter(
      pool => oldPool && pool.id === oldPool.id,
    )[0];
    if (poolState) result.push(poolState);
  }

  return result;
}
