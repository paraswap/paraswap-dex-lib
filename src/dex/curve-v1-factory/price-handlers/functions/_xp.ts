import _ from 'lodash';
import { funcName } from '../../../../utils';
import { ImplementationNames, PoolState } from '../../types';
import { IPoolContext, _xp } from '../types';
import { requireConstant, throwNotExist } from './utils';

const customPlain3CoinThree: _xp = (
  self: IPoolContext,
  state: PoolState,
): bigint[] => {
  const { N_COINS } = self.constants;
  const RATES = requireConstant(self, 'RATES', funcName());
  const LENDING_PRECISION = requireConstant(
    self,
    'LENDING_PRECISION',
    funcName(),
  );
  const result = [...RATES];
  for (const i of _.range(N_COINS)) {
    result[i] = (result[i] * state.balances[i]) / LENDING_PRECISION;
  }
  return result;
};

const customPlain2CoinFrax: _xp = (
  self: IPoolContext,
  state: PoolState,
): bigint[] => {
  const { N_COINS, PRECISION } = self.constants;
  const RATES = requireConstant(self, 'RATES', funcName());
  const result = [...RATES];
  for (const i of _.range(Number(N_COINS))) {
    result[i] = (result[i] * state.balances[i]) / PRECISION;
  }
  return result;
};

const customPlain3CoinSbtc: _xp = (
  self: IPoolContext,
  state: PoolState,
): bigint[] => {
  const { N_COINS, PRECISION } = self.constants;
  const result = self._rates(self, state);
  for (const i of _.range(Number(N_COINS))) {
    result[i] = (result[i] * state.balances[i]) / PRECISION;
  }
  return result;
};

const notExist: _xp = (self: IPoolContext, state: PoolState) => {
  return throwNotExist('_xp', self.IMPLEMENTATION_NAME);
};

const implementations: Record<ImplementationNames, _xp> = {
  [ImplementationNames.CUSTOM_PLAIN_2COIN_FRAX]: customPlain2CoinFrax,
  [ImplementationNames.CUSTOM_PLAIN_2COIN_RENBTC]: customPlain3CoinSbtc,
  [ImplementationNames.CUSTOM_PLAIN_3COIN_SBTC]: customPlain3CoinSbtc,
  [ImplementationNames.CUSTOM_PLAIN_3COIN_THREE]: customPlain3CoinThree,

  [ImplementationNames.CUSTOM_ARBITRUM_2COIN_BTC]: notExist,
  [ImplementationNames.CUSTOM_ARBITRUM_2COIN_USD]: notExist,

  [ImplementationNames.CUSTOM_AVALANCHE_3COIN_LENDING]: notExist,

  [ImplementationNames.CUSTOM_FANTOM_2COIN_BTC]: customPlain2CoinFrax,
  [ImplementationNames.CUSTOM_FANTOM_2COIN_USD]: notExist,
  [ImplementationNames.CUSTOM_FANTOM_3COIN_LENDING]: notExist,

  [ImplementationNames.CUSTOM_OPTIMISM_3COIN_USD]: notExist,

  [ImplementationNames.CUSTOM_POLYGON_2COIN_LENDING]: notExist,
  [ImplementationNames.CUSTOM_POLYGON_3COIN_LENDING]: notExist,

  [ImplementationNames.FACTORY_V1_META_BTC]: notExist,
  [ImplementationNames.FACTORY_V1_META_USD]: notExist,

  [ImplementationNames.FACTORY_META_BTC]: notExist,
  [ImplementationNames.FACTORY_META_BTC_BALANCES]: notExist,

  [ImplementationNames.FACTORY_META_BTC_REN]: notExist,
  [ImplementationNames.FACTORY_META_BTC_BALANCES_REN]: notExist,

  [ImplementationNames.FACTORY_META_USD]: notExist,
  [ImplementationNames.FACTORY_META_USD_BALANCES]: notExist,

  [ImplementationNames.FACTORY_META_USD_FRAX_USDC]: notExist,
  [ImplementationNames.FACTORY_META_USD_BALANCES_FRAX_USDC]: notExist,

  [ImplementationNames.FACTORY_PLAIN_2_BALANCES]: notExist,
  [ImplementationNames.FACTORY_PLAIN_2_BASIC]: notExist,
  [ImplementationNames.FACTORY_PLAIN_2_ETH]: notExist,
  [ImplementationNames.FACTORY_PLAIN_2_OPTIMIZED]: notExist,

  [ImplementationNames.FACTORY_PLAIN_3_BALANCES]: notExist,
  [ImplementationNames.FACTORY_PLAIN_3_BASIC]: notExist,
  [ImplementationNames.FACTORY_PLAIN_3_ETH]: notExist,
  [ImplementationNames.FACTORY_PLAIN_3_OPTIMIZED]: notExist,

  [ImplementationNames.FACTORY_PLAIN_4_BALANCES]: notExist,
  [ImplementationNames.FACTORY_PLAIN_4_BASIC]: notExist,
  [ImplementationNames.FACTORY_PLAIN_4_ETH]: notExist,
  [ImplementationNames.FACTORY_PLAIN_4_OPTIMIZED]: notExist,
};

export default implementations;
