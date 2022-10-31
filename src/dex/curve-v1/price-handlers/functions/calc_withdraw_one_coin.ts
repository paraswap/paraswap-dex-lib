import { ImplementationNames, PoolState } from '../../types';
import { calc_withdraw_one_coin, IPoolContext } from '../types';
import { throwNotImplemented } from './utils';

const customPlain3CoinThree: calc_withdraw_one_coin = (
  self: IPoolContext,
  state: PoolState,
  _token_amount: bigint,
  i: number,
): bigint => {
  return self._calc_withdraw_one_coin(self, state, _token_amount, i)[0];
};

const notImplemented: calc_withdraw_one_coin = (
  self: IPoolContext,
  state: PoolState,
  _token_amount: bigint,
  i: number,
) => {
  return throwNotImplemented(
    'calc_withdraw_once_coin',
    self.IMPLEMENTATION_NAME,
  );
};

export const implementations: Record<
  ImplementationNames,
  calc_withdraw_one_coin
> = {
  [ImplementationNames.CUSTOM_PLAIN_2COIN_FRAX]: customPlain3CoinThree,
  [ImplementationNames.CUSTOM_PLAIN_3COIN_BTC]: customPlain3CoinThree,
  [ImplementationNames.CUSTOM_PLAIN_3COIN_THREE]: customPlain3CoinThree,

  [ImplementationNames.FACTORY_META_3POOL_2_8]: notImplemented,
  [ImplementationNames.FACTORY_META_3POOL_2_15]: notImplemented,

  [ImplementationNames.FACTORY_META_3POOL_3_1]: notImplemented,
  [ImplementationNames.FACTORY_META_3POOL_ERC20_FEE_TRANSFER]: notImplemented,
  [ImplementationNames.FACTORY_META_SBTC_ERC20]: notImplemented,

  [ImplementationNames.FACTORY_PLAIN_2COIN_ERC20]: notImplemented,
  [ImplementationNames.FACTORY_PLAIN_2COIN_ERC20_18DEC]: notImplemented,
  [ImplementationNames.FACTORY_PLAIN_2COIN_ERC20_FEE_TRANSFER]: notImplemented,
  [ImplementationNames.FACTORY_PLAIN_2COIN_NATIVE]: notImplemented,

  [ImplementationNames.FACTORY_PLAIN_3COIN_ERC20]: notImplemented,
  [ImplementationNames.FACTORY_PLAIN_3COIN_ERC20_18DEC]: notImplemented,
  [ImplementationNames.FACTORY_PLAIN_3COIN_ERC20_FEE_TRANSFER]: notImplemented,

  [ImplementationNames.FACTORY_PLAIN_4COIN_ERC20]: notImplemented,
  [ImplementationNames.FACTORY_PLAIN_4COIN_ERC20_18DEC]: notImplemented,
};

export default implementations;
