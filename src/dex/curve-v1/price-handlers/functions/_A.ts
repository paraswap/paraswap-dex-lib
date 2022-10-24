import { ImplementationNames, PoolState } from '../../types';

export type _A = (state: PoolState) => bigint;

const fromState: _A = (state: PoolState) => {
  // We update this A on every state fetching. I believe we will not need to
  // calculate it manually. But in case if it is needed, it can be overridden
  // by any class that inherits the base one
  return state.A;
};

const implementations: Record<ImplementationNames, _A> = {
  [ImplementationNames.FACTORY_META_3POOL_2_15]: fromState,
  [ImplementationNames.FACTORY_META_3POOL_2_8]: fromState,
  [ImplementationNames.FACTORY_META_3POOL_3_1]: fromState,
  [ImplementationNames.FACTORY_META_3POOL_ERC20_FEE_TRANSFER]: fromState,
  [ImplementationNames.FACTORY_META_SBTC_ERC20]: fromState,
  [ImplementationNames.FACTORY_PLAIN_2COIN_ERC20]: fromState,
  [ImplementationNames.FACTORY_PLAIN_2COIN_ERC20_18DEC]: fromState,
  [ImplementationNames.FACTORY_PLAIN_2COIN_ERC20_FEE_TRANSFER]: fromState,
  [ImplementationNames.FACTORY_PLAIN_2COIN_NATIVE]: fromState,
  [ImplementationNames.FACTORY_PLAIN_3COIN_ERC20]: fromState,
  [ImplementationNames.FACTORY_PLAIN_3COIN_ERC20_18DEC]: fromState,
  [ImplementationNames.FACTORY_PLAIN_3COIN_ERC20_FEE_TRANSFER]: fromState,
  [ImplementationNames.FACTORY_PLAIN_4COIN_ERC20]: fromState,
  [ImplementationNames.FACTORY_PLAIN_4COIN_ERC20_18DEC]: fromState,
};

export default implementations;
