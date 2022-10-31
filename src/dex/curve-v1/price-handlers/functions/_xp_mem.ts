import _ from 'lodash';
import { funcName } from '../../../../utils';
import { ImplementationNames } from '../../types';
import { IPoolContext, _xp_mem } from '../types';
import { requireConstant } from './utils';

const customPlain3CoinThree: _xp_mem = (
  self: IPoolContext,
  _rates: bigint[],
  _balances: bigint[],
): bigint[] => {
  const { N_COINS, PRECISION } = self.constants;
  const RATES = requireConstant(self, 'RATES', funcName());
  const result = [...RATES];
  for (const i of _.range(Number(N_COINS))) {
    result[i] = (result[i] * _balances[i]) / PRECISION;
  }
  return result;
};

const customPlain3CoinBtc: _xp_mem = (
  self: IPoolContext,
  _rates: bigint[],
  _balances: bigint[],
): bigint[] => {
  const { N_COINS, PRECISION } = self.constants;
  const result = [..._rates];
  for (const i of _.range(Number(N_COINS))) {
    result[i] = (result[i] * _balances[i]) / PRECISION;
  }
  return result;
};

const factoryPlain2CoinErc20: _xp_mem = (
  self: IPoolContext,
  _rates: bigint[],
  _balances: bigint[],
): bigint[] => {
  const { N_COINS, PRECISION } = self.constants;

  const result = new Array(N_COINS).fill(0n);
  for (const i of _.range(Number(N_COINS))) {
    result[i] = (_rates[i] * _balances[i]) / PRECISION;
  }
  return result;
};

const implementations: Record<ImplementationNames, _xp_mem> = {
  [ImplementationNames.CUSTOM_PLAIN_2COIN_FRAX]: customPlain3CoinThree,
  [ImplementationNames.CUSTOM_PLAIN_3COIN_BTC]: customPlain3CoinBtc,
  [ImplementationNames.CUSTOM_PLAIN_3COIN_THREE]: customPlain3CoinThree,

  [ImplementationNames.FACTORY_META_3POOL_2_8]: factoryPlain2CoinErc20,
  [ImplementationNames.FACTORY_META_3POOL_2_15]: factoryPlain2CoinErc20,

  [ImplementationNames.FACTORY_META_FRAX]: factoryPlain2CoinErc20,
  [ImplementationNames.FACTORY_META_3POOL_FEE_TRANSFER]: factoryPlain2CoinErc20,
  [ImplementationNames.FACTORY_META_BTC]: factoryPlain2CoinErc20,

  [ImplementationNames.FACTORY_PLAIN_2COIN_ERC20]: factoryPlain2CoinErc20,
  [ImplementationNames.FACTORY_PLAIN_2COIN_ERC20_18DEC]: factoryPlain2CoinErc20,
  [ImplementationNames.FACTORY_PLAIN_2COIN_ERC20_FEE_TRANSFER]:
    factoryPlain2CoinErc20,
  [ImplementationNames.FACTORY_PLAIN_2COIN_NATIVE]: factoryPlain2CoinErc20,

  [ImplementationNames.FACTORY_PLAIN_3COIN_ERC20]: factoryPlain2CoinErc20,
  [ImplementationNames.FACTORY_PLAIN_3COIN_ERC20_18DEC]: factoryPlain2CoinErc20,
  [ImplementationNames.FACTORY_PLAIN_3COIN_ERC20_FEE_TRANSFER]:
    factoryPlain2CoinErc20,

  [ImplementationNames.FACTORY_PLAIN_4COIN_ERC20]: factoryPlain2CoinErc20,
  [ImplementationNames.FACTORY_PLAIN_4COIN_ERC20_18DEC]: factoryPlain2CoinErc20,
};

export default implementations;
