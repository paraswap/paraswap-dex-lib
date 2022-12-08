import _ from 'lodash';
import { _require } from '../../../../utils';
import { ImplementationNames } from '../../types';
import { get_y_D, IPoolContext } from '../types';
import { requireConstant, throwNotImplemented } from './utils';

const customPlain3CoinThree: get_y_D = (
  self: IPoolContext,
  A: bigint,
  i: number,
  xp: bigint[],
  D: bigint,
): bigint => {
  const { N_COINS, BI_N_COINS } = self.constants;
  _require(i >= 0, 'i below zero', { A, i, xp, D }, 'i >== 0');
  _require(i < N_COINS, 'i above N_COINS', { A, i, xp, D }, 'i < N_COINS');

  let c = D;
  let S_ = 0n;
  const Ann = A * BI_N_COINS;

  let _x = 0n;

  for (const _i of _.range(N_COINS)) {
    if (_i !== i) {
      _x = xp[_i];
    } else {
      continue;
    }
    S_ += _x;
    c = (c * D) / (_x * BI_N_COINS);
  }
  c = (c * D) / (Ann * BI_N_COINS);
  const b = S_ + D / Ann;

  let y_prev = 0n;
  let y = D;

  for (const _i of _.range(255)) {
    y_prev = y;
    y = (y * y + c) / (2n * y + b - D);
    // Equality with the precision of 1
    if (y > y_prev) {
      if (y - y_prev <= 1) {
        break;
      }
    } else {
      if (y_prev - y <= 1n) {
        break;
      }
    }
  }
  return y;
};

const customPlain2CoinFrax: get_y_D = (
  self: IPoolContext,
  A: bigint,
  i: number,
  xp: bigint[],
  D: bigint,
): bigint => {
  const { N_COINS, BI_N_COINS } = self.constants;
  const A_PRECISION = requireConstant(
    self,
    'A_PRECISION',
    'customPlain2CoinFrax',
  );

  _require(i >= 0, 'i below zero', { A_: A, i, xp, D }, 'i >== 0');
  _require(i < N_COINS, 'i above N_COINS', { A_: A, i, xp, D }, 'i < N_COINS');

  const Ann = A * BI_N_COINS;
  let c = D;
  let S = 0n;
  let _x = 0n;
  let y_prev = 0n;

  for (const _i of _.range(N_COINS)) {
    if (_i !== i) {
      _x = xp[_i];
    } else {
      continue;
    }
    S += _x;
    c = (c * D) / (_x * BI_N_COINS);
  }
  c = (c * D * A_PRECISION) / (Ann * BI_N_COINS);
  const b = S + (D * A_PRECISION) / Ann;
  let y = D;

  for (const _i of _.range(255)) {
    y_prev = y;
    y = (y * y + c) / (2n * y + b - D);
    // Equality with the precision of 1
    if (y > y_prev) {
      if (y - y_prev <= 1) {
        return y;
      }
    } else {
      if (y_prev - y <= 1n) {
        return y;
      }
    }
  }
  throw new Error(
    `${self.IMPLEMENTATION_NAME}: function customPlain2CoinFrax didn't converge`,
  );
};

const notImplemented: get_y_D = (
  self: IPoolContext,
  A: bigint,
  i: number,
  xp: bigint[],
  D: bigint,
) => {
  return throwNotImplemented('get_y_D', self.IMPLEMENTATION_NAME);
};

const implementations: Record<ImplementationNames, get_y_D> = {
  [ImplementationNames.CUSTOM_PLAIN_2COIN_FRAX]: customPlain2CoinFrax,
  [ImplementationNames.CUSTOM_PLAIN_2COIN_RENBTC]: customPlain3CoinThree,
  [ImplementationNames.CUSTOM_PLAIN_3COIN_SBTC]: customPlain3CoinThree,
  [ImplementationNames.CUSTOM_PLAIN_3COIN_THREE]: customPlain3CoinThree,

  [ImplementationNames.CUSTOM_ARBITRUM_2COIN_BTC]: customPlain2CoinFrax,
  [ImplementationNames.CUSTOM_ARBITRUM_2COIN_USD]: customPlain2CoinFrax,

  [ImplementationNames.CUSTOM_AVALANCHE_3COIN_LENDING]: customPlain2CoinFrax,

  [ImplementationNames.CUSTOM_FANTOM_2COIN_BTC]: customPlain2CoinFrax,
  [ImplementationNames.CUSTOM_FANTOM_2COIN_USD]: customPlain2CoinFrax,
  [ImplementationNames.CUSTOM_FANTOM_3COIN_LENDING]: customPlain2CoinFrax,

  [ImplementationNames.CUSTOM_OPTIMISM_3COIN_USD]: customPlain2CoinFrax,

  [ImplementationNames.CUSTOM_POLYGON_2COIN_LENDING]: customPlain2CoinFrax,
  [ImplementationNames.CUSTOM_POLYGON_3COIN_LENDING]: customPlain2CoinFrax,

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
  [ImplementationNames.FACTORY_PLAIN_2_BASIC]: customPlain2CoinFrax,
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
