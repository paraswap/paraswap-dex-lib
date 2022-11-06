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

const customPlain3CoinSbtc: _xp_mem = (
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

const factoryPlain2Basic: _xp_mem = (
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
  [ImplementationNames.CUSTOM_PLAIN_2COIN_RENBTC]: customPlain3CoinSbtc,
  [ImplementationNames.CUSTOM_PLAIN_3COIN_SBTC]: customPlain3CoinSbtc,
  [ImplementationNames.CUSTOM_PLAIN_3COIN_THREE]: customPlain3CoinThree,

  [ImplementationNames.CUSTOM_ARBITRUM_2COIN_BTC]: CHANGE,
  [ImplementationNames.CUSTOM_ARBITRUM_2COIN_USD]: CHANGE,

  [ImplementationNames.CUSTOM_AVALANCHE_3COIN_LENDING]: CHANGE,

  [ImplementationNames.CUSTOM_FANTOM_2COIN_BTC]: CHANGE,
  [ImplementationNames.CUSTOM_FANTOM_2COIN_USD]: CHANGE,
  [ImplementationNames.CUSTOM_FANTOM_3COIN_LENDING]: CHANGE,

  [ImplementationNames.CUSTOM_OPTIMISM_3COIN_USD]: CHANGE,

  [ImplementationNames.CUSTOM_POLYGON_2COIN_LENDING]: CHANGE,
  [ImplementationNames.CUSTOM_POLYGON_3COIN_LENDING]: CHANGE,

  [ImplementationNames.FACTORY_V1_META_BTC]: factoryPlain2Basic,
  [ImplementationNames.FACTORY_V1_META_USD]: factoryPlain2Basic,

  [ImplementationNames.FACTORY_META_BTC]: factoryPlain2Basic,
  [ImplementationNames.FACTORY_META_BTC_BALANCES]: factoryPlain2Basic,

  [ImplementationNames.FACTORY_META_BTC_REN]: factoryPlain2Basic,
  [ImplementationNames.FACTORY_META_BTC_BALANCES_REN]: factoryPlain2Basic,

  [ImplementationNames.FACTORY_META_USD]: factoryPlain2Basic,
  [ImplementationNames.FACTORY_META_USD_BALANCES]: factoryPlain2Basic,

  [ImplementationNames.FACTORY_META_USD_FRAX_USDC]: factoryPlain2Basic,
  [ImplementationNames.FACTORY_META_USD_BALANCES_FRAX_USDC]: factoryPlain2Basic,

  [ImplementationNames.FACTORY_PLAIN_2_BASIC]: factoryPlain2Basic,
  [ImplementationNames.FACTORY_PLAIN_2_OPTIMIZED]: factoryPlain2Basic,
  [ImplementationNames.FACTORY_PLAIN_2_BALANCES]: factoryPlain2Basic,
  [ImplementationNames.FACTORY_PLAIN_2_ETH]: factoryPlain2Basic,

  [ImplementationNames.FACTORY_PLAIN_3_BASIC]: factoryPlain2Basic,
  [ImplementationNames.FACTORY_PLAIN_3_OPTIMIZED]: factoryPlain2Basic,
  [ImplementationNames.FACTORY_PLAIN_3_BALANCES]: factoryPlain2Basic,
  [ImplementationNames.FACTORY_PLAIN_3_ETH]: factoryPlain2Basic,

  [ImplementationNames.FACTORY_PLAIN_4_BASIC]: factoryPlain2Basic,
  [ImplementationNames.FACTORY_PLAIN_4_OPTIMIZED]: factoryPlain2Basic,
  [ImplementationNames.FACTORY_PLAIN_4_BALANCES]: factoryPlain2Basic,
  [ImplementationNames.FACTORY_PLAIN_4_ETH]: factoryPlain2Basic,
};

export default implementations;
