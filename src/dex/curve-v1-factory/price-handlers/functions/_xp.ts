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
  for (const i of _.range(Number(N_COINS))) {
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

  [ImplementationNames.FACTORY_META_3POOL_2_8]: notExist,
  [ImplementationNames.FACTORY_META_3POOL_2_15]: notExist,
  [ImplementationNames.FACTORY_META_3POOL_FEE_TRANSFER]: notExist,

  [ImplementationNames.FACTORY_META_FRAX]: notExist,
  [ImplementationNames.FACTORY_META_FRAX_FEE_TRANSFER]: notExist,

  [ImplementationNames.FACTORY_META_RENBTC]: notExist,
  [ImplementationNames.FACTORY_META_RENBTC_FEE_TRANSFER]: notExist,

  [ImplementationNames.FACTORY_META_SBTC]: notExist,
  [ImplementationNames.FACTORY_META_SBTC_FEE_TRANSFER]: notExist,

  [ImplementationNames.FACTORY_PLAIN_2COIN_ERC20]: notExist,
  [ImplementationNames.FACTORY_PLAIN_2COIN_ERC20_18DEC]: notExist,
  [ImplementationNames.FACTORY_PLAIN_2COIN_ERC20_FEE_TRANSFER]: notExist,
  [ImplementationNames.FACTORY_PLAIN_2COIN_NATIVE]: notExist,

  [ImplementationNames.FACTORY_PLAIN_3COIN_ERC20]: notExist,
  [ImplementationNames.FACTORY_PLAIN_3COIN_ERC20_18DEC]: notExist,
  [ImplementationNames.FACTORY_PLAIN_3COIN_ERC20_FEE_TRANSFER]: notExist,
  [ImplementationNames.FACTORY_PLAIN_3COIN_NATIVE]: notExist,

  [ImplementationNames.FACTORY_PLAIN_4COIN_ERC20]: notExist,
  [ImplementationNames.FACTORY_PLAIN_4COIN_ERC20_18DEC]: notExist,
};

export default implementations;
