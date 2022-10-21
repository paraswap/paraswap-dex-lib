import { ImplementationNames, PoolState } from '../../types';

export type _A = (state: PoolState) => bigint;

const factoryPlain2CoinErc20: _A = (state: PoolState) => {
  // We update this A on every state fetching. I believe we will not need to
  // calculate it manually. But in case if it is needed, it can be overridden
  // by any class that inherits the base one
  return state.A;
};

export const mappings: Record<ImplementationNames, _A> = {
  [ImplementationNames.FACTORY_PLAIN_2COIN_ERC20]: factoryPlain2CoinErc20,
};
