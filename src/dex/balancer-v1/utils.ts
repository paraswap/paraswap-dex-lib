import { PoolState, Token as SORToken } from './types';
import { bignumberify } from '../../utils';

export function typecastReadOnlyToken(readOnlyToken: any): SORToken {
  return {
    address: readOnlyToken.address,
    balance: bignumberify(readOnlyToken.balance),
    decimals: readOnlyToken.decimals,
    denormWeight: bignumberify(readOnlyToken.denormWeight),
  };
}

export function typecastReadOnlyPool(readOnlyPool: any): PoolState {
  return {
    id: readOnlyPool.id,
    swapFee: bignumberify(readOnlyPool.swapFee),
    totalWeight: bignumberify(readOnlyPool.totalWeight),
    tokens: readOnlyPool.tokens.map(typecastReadOnlyToken),
    tokensList: readOnlyPool.tokensList,
  };
}
