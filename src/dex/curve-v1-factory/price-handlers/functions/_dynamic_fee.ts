import _ from 'lodash';
import { ImplementationNames } from '../../types';
import { IPoolContext, _dynamic_fee } from '../types';
import { throwNotExist } from './utils';

const customAvalanche3CoinLending: _dynamic_fee = (
  self: IPoolContext,
  xpi: bigint,
  xpj: bigint,
  _fee: bigint,
  _feemul: bigint,
): bigint => {
  const { FEE_DENOMINATOR } = self.constants;
  if (_feemul <= FEE_DENOMINATOR) {
    return _fee;
  } else {
    let xps2 = xpi + xpj;
    xps2 *= xps2; // Doing just ** 2 can overflow apparently
    return (
      (_feemul * _fee) /
      (((_feemul - FEE_DENOMINATOR) * 4n * xpi * xpj) / xps2 + FEE_DENOMINATOR)
    );
  }
};

const notExist: _dynamic_fee = (
  self: IPoolContext,
  xpi: bigint,
  xpj: bigint,
  _fee: bigint,
  _feemul: bigint,
) => {
  return throwNotExist('_dynamic_fee', self.IMPLEMENTATION_NAME);
};

const implementations: Record<ImplementationNames, _dynamic_fee> = {
  [ImplementationNames.CUSTOM_PLAIN_2COIN_FRAX]: notExist,
  [ImplementationNames.CUSTOM_PLAIN_2COIN_RENBTC]: notExist,
  [ImplementationNames.CUSTOM_PLAIN_2COIN_WBTC]: notExist,
  [ImplementationNames.CUSTOM_PLAIN_3COIN_SBTC]: notExist,
  [ImplementationNames.CUSTOM_PLAIN_3COIN_THREE]: notExist,

  [ImplementationNames.CUSTOM_ARBITRUM_2COIN_BTC]: notExist,
  [ImplementationNames.CUSTOM_ARBITRUM_2COIN_USD]: notExist,

  [ImplementationNames.CUSTOM_AVALANCHE_3COIN_LENDING]:
    customAvalanche3CoinLending,

  [ImplementationNames.CUSTOM_FANTOM_2COIN_BTC]: notExist,
  [ImplementationNames.CUSTOM_FANTOM_2COIN_USD]: notExist,
  [ImplementationNames.CUSTOM_FANTOM_3COIN_LENDING]:
    customAvalanche3CoinLending,

  [ImplementationNames.CUSTOM_OPTIMISM_3COIN_USD]: notExist,

  [ImplementationNames.CUSTOM_POLYGON_2COIN_LENDING]:
    customAvalanche3CoinLending,
  [ImplementationNames.CUSTOM_POLYGON_3COIN_LENDING]:
    customAvalanche3CoinLending,

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
