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

const customPlain3CoinSbtc = (
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
  [ImplementationNames.CUSTOM_PLAIN_2COIN_RENBTC]: customPlain3CoinSbtc,
  [ImplementationNames.CUSTOM_PLAIN_3COIN_SBTC]: customPlain3CoinSbtc,
  [ImplementationNames.CUSTOM_PLAIN_3COIN_THREE]: customPlain3CoinThree,

  [ImplementationNames.FACTORY_V1_META_BTC]: notImplemented,
  [ImplementationNames.FACTORY_V1_META_USD]: notImplemented,

  [ImplementationNames.FACTORY_META_BTC]: notImplemented,
  [ImplementationNames.FACTORY_META_BTC_BALANCES]: notImplemented,

  [ImplementationNames.FACTORY_META_BTC_REN]: notImplemented,
  [ImplementationNames.FACTORY_META_BTC_BALANCES_REN]: notImplemented,

  [ImplementationNames.FACTORY_META_USD]: notImplemented,
  [ImplementationNames.FACTORY_META_USD_BALANCES]: notImplemented,

  [ImplementationNames.FACTORY_META_USD_FRAX_USDC]: notImplemented,
  [ImplementationNames.FACTORY_META_USD_BALANCES_FRAX_USDC]: notImplemented,

  [ImplementationNames.FACTORY_PLAIN_2_BALANCES]: notImplemented,
  [ImplementationNames.FACTORY_PLAIN_2_BASIC]: CHANGE,
  [ImplementationNames.FACTORY_PLAIN_2_ETH]: notImplemented,
  [ImplementationNames.FACTORY_PLAIN_2_OPTIMIZED]: notImplemented,

  [ImplementationNames.FACTORY_PLAIN_3_BALANCES]: notImplemented,
  [ImplementationNames.FACTORY_PLAIN_3_BASIC]: notImplemented,
  [ImplementationNames.FACTORY_PLAIN_3_ETH]: notImplemented,
  [ImplementationNames.FACTORY_PLAIN_3_OPTIMIZED]: notImplemented,

  [ImplementationNames.FACTORY_PLAIN_4_BALANCES]: notImplemented,
  [ImplementationNames.FACTORY_PLAIN_4_BASIC]: notImplemented,
  [ImplementationNames.FACTORY_PLAIN_4_ETH]: notImplemented,
  [ImplementationNames.FACTORY_PLAIN_4_OPTIMIZED]: notImplemented,
};

export default implementations;
