import _ from 'lodash';
import { ImplementationNames, PoolState } from '../../types';
import { IPoolContext, _rates } from '../types';
import { throwNotExist, requireConstant } from './utils';

const customPlain3CoinSbtc: _rates = (
  self: IPoolContext,
  state: PoolState,
): bigint[] => {
  const { N_COINS } = self.constants;
  const USE_LENDING = requireConstant(
    self,
    'USE_LENDING',
    'customPlain3CoinSbtc',
  );
  const LENDING_PRECISION = requireConstant(
    self,
    'LENDING_PRECISION',
    'customPlain3CoinSbtc',
  );
  const PRECISION_MUL = requireConstant(
    self,
    'PRECISION_MUL',
    'customPlain3CoinSbtc',
  );

  if (state.exchangeRateCurrent === undefined) {
    throw new Error(
      `${self.IMPLEMENTATION_NAME} customPlain3CoinSbtc: exchangeRateCurrent is not provided`,
    );
  }

  const result = [...PRECISION_MUL];
  const use_lending = [...USE_LENDING];
  for (const i of _.range(N_COINS)) {
    let rate = LENDING_PRECISION; // Used with no lending
    if (use_lending[i]) {
      const currentRate = state.exchangeRateCurrent[i];
      if (currentRate === undefined) {
        throw new Error(
          `${self.IMPLEMENTATION_NAME}: exchangeRateCurrent contains undefined value that supposed to be used: ${state.exchangeRateCurrent}`,
        );
      }
      rate = currentRate;
    }
    result[i] *= rate;
  }
  return result;
};

const notExist: _rates = (self: IPoolContext, state: PoolState) => {
  return throwNotExist('_rates', self.IMPLEMENTATION_NAME);
};

const implementations: Record<ImplementationNames, _rates> = {
  [ImplementationNames.CUSTOM_PLAIN_2COIN_FRAX]: notExist,
  [ImplementationNames.CUSTOM_PLAIN_2COIN_RENBTC]: customPlain3CoinSbtc,
  [ImplementationNames.CUSTOM_PLAIN_3COIN_SBTC]: customPlain3CoinSbtc,
  [ImplementationNames.CUSTOM_PLAIN_3COIN_THREE]: notExist,

  [ImplementationNames.CUSTOM_ARBITRUM_2COIN_BTC]: notExist,
  [ImplementationNames.CUSTOM_ARBITRUM_2COIN_USD]: notExist,

  [ImplementationNames.CUSTOM_AVALANCHE_3COIN_LENDING]: notExist,

  [ImplementationNames.CUSTOM_FANTOM_2COIN_BTC]: notExist,
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
