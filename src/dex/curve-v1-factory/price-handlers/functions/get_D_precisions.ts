import _ from 'lodash';
import { ImplementationNames } from '../../types';
import { get_D_precisions, IPoolContext } from '../types';
import {
  getCachedValueOrCallFunc,
  requireConstant,
  throwNotExist,
} from './utils';

const customAvalanche3CoinLending: get_D_precisions = (
  self: IPoolContext,
  coin_balances: bigint[],
  amp: bigint,
): bigint => {
  const { N_COINS } = self.constants;
  const PRECISION_MUL = requireConstant(
    self,
    'PRECISION_MUL',
    'customAvalanche3CoinLending',
  );
  const xp = [...PRECISION_MUL];
  for (const i of _.range(N_COINS)) {
    xp[i] *= coin_balances[i];
  }
  return self.get_D(self, xp, amp);
};

const notExist: get_D_precisions = (
  self: IPoolContext,
  coin_balances: bigint[],
  amp: bigint,
) => {
  return throwNotExist('get_D_precisions', self.IMPLEMENTATION_NAME);
};

const makeFuncCacheable = (func: get_D_precisions): get_D_precisions => {
  return (self: IPoolContext, coin_balances: bigint[], amp: bigint) => {
    const cacheKey =
      `get_D_precisions-` +
      `PRECISION_MUL:${self.constants.PRECISION_MUL?.join(',')}` +
      `coin_balances:${coin_balances.join(',')}-` +
      `amp:${amp}`;

    return getCachedValueOrCallFunc(
      cacheKey,
      func.bind(undefined, self, coin_balances, amp),
    );
  };
};

const implementations: Record<ImplementationNames, get_D_precisions> = {
  [ImplementationNames.CUSTOM_PLAIN_2COIN_FRAX]: notExist,
  [ImplementationNames.CUSTOM_PLAIN_2COIN_RENBTC]: notExist,
  [ImplementationNames.CUSTOM_PLAIN_2COIN_WBTC]: notExist,
  [ImplementationNames.CUSTOM_PLAIN_3COIN_SBTC]: notExist,
  [ImplementationNames.CUSTOM_PLAIN_3COIN_THREE]: notExist,

  [ImplementationNames.CUSTOM_ARBITRUM_2COIN_BTC]: notExist,
  [ImplementationNames.CUSTOM_ARBITRUM_2COIN_USD]: notExist,

  [ImplementationNames.CUSTOM_AVALANCHE_3COIN_LENDING]: makeFuncCacheable(
    customAvalanche3CoinLending,
  ),

  [ImplementationNames.CUSTOM_FANTOM_2COIN_BTC]: notExist,
  [ImplementationNames.CUSTOM_FANTOM_2COIN_USD]: notExist,
  [ImplementationNames.CUSTOM_FANTOM_3COIN_LENDING]: makeFuncCacheable(
    customAvalanche3CoinLending,
  ),

  [ImplementationNames.CUSTOM_OPTIMISM_3COIN_USD]: notExist,

  [ImplementationNames.CUSTOM_POLYGON_2COIN_LENDING]: makeFuncCacheable(
    customAvalanche3CoinLending,
  ),
  [ImplementationNames.CUSTOM_POLYGON_3COIN_LENDING]: makeFuncCacheable(
    customAvalanche3CoinLending,
  ),

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

  [ImplementationNames.FACTORY_META_BTC_SBTC2]: notExist,
  [ImplementationNames.FACTORY_META_BTC_BALANCES_SBTC2]: notExist,
  [ImplementationNames.FACTORY_PLAIN_2_BASIC_EMA]: notExist,
  [ImplementationNames.FACTORY_PLAIN_2_ETH_EMA]: notExist,
  [ImplementationNames.FACTORY_PLAIN_2_ETH_EMA2]: notExist,
};

export default implementations;
