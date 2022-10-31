import _ from 'lodash';
import { funcName } from '../../../../utils';
import { ImplementationNames, PoolState } from '../../types';
import { get_D_mem, IPoolContext } from '../types';
import { requireConstant, throwNotImplemented } from './utils';

const customPlain3CoinThree = (
  self: IPoolContext,
  state: PoolState,
  _balances: bigint[],
  amp: bigint,
): bigint => {
  const RATES = requireConstant(self, 'RATES', funcName());
  return self.get_D(self, self._xp_mem(self, RATES, _balances), amp);
};

const customPlain3CoinBTC = (
  self: IPoolContext,
  state: PoolState,
  _balances: bigint[],
  amp: bigint,
): bigint => {
  return self.get_D(
    self,
    self._xp_mem(self, self._rates(self, state), _balances),
    amp,
  );
};

const notImplemented: get_D_mem = (
  self: IPoolContext,
  state: PoolState,
  _balances: bigint[],
  amp: bigint,
) => {
  return throwNotImplemented('get_D_mem', self.IMPLEMENTATION_NAME);
};

export const implementations: Record<ImplementationNames, get_D_mem> = {
  [ImplementationNames.CUSTOM_PLAIN_2COIN_FRAX]: customPlain3CoinThree,
  [ImplementationNames.CUSTOM_PLAIN_3COIN_BTC]: customPlain3CoinBTC,
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
