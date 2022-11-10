import _ from 'lodash';
import { ImplementationNames, PoolState } from '../../types';
import { _require } from '../../../../utils';
import { get_y, IPoolContext } from '../types';
import { requireConstant } from './utils';

const customPlain3CoinThree = (
  self: IPoolContext,
  state: PoolState,
  i: number,
  j: number,
  x: bigint,
  xp: bigint[],
): bigint => {
  const { N_COINS, BI_N_COINS } = self.constants;
  // x in the input is converted to the same price/precision

  _require(i !== j, 'same coin', { i, j }, 'i !== j');
  _require(j >= 0, 'j below zero', { i, j }, 'j >= 0');
  _require(j < N_COINS, 'j above N_COINS', { i, j, N_COINS }, 'j < N_COINS');

  // should be unreachable, but good for safety
  _require(i >= 0, 'i below zero', { i, j }, 'i >= 0');
  _require(i < N_COINS, 'i above N_COINS', { i, j, N_COINS }, 'i < N_COINS');

  const amp = state.A;
  const D = self.get_D(self, xp, amp);
  let c = D;
  let S_ = 0n;
  const Ann = amp * BI_N_COINS;

  let _x = 0n;
  for (const _i of _.range(N_COINS)) {
    if (_i === i) {
      _x = x;
    } else if (_i !== j) {
      _x = xp[_i];
    } else {
      continue;
    }
    S_ += _x;
    c = (c * D) / (_x * BI_N_COINS);
  }
  c = (c * D) / (Ann * BI_N_COINS);
  const b = S_ + D / Ann; // - D
  let y_prev = 0n;
  let y = D;

  for (const _i of _.range(255)) {
    y_prev = y;
    y = (y * y + c) / (2n * y + b - D);
    //
    // Equality with the precision of 1
    if (y > y_prev) {
      if (y - y_prev <= 1) {
        break;
      }
    } else {
      if (y_prev - y <= 1) {
        break;
      }
    }
  }
  return y;
};

const customPlain2CoinFrax = (
  self: IPoolContext,
  state: PoolState,
  i: number,
  j: number,
  x: bigint,
  xp: bigint[],
) => {
  const { N_COINS, BI_N_COINS } = self.constants;
  const A_PRECISION = requireConstant(
    self,
    'A_PRECISION',
    'customPlain2CoinFrax',
  );

  // x in the input is converted to the same price/precision

  _require(i !== j, 'same coin', { i, j }, 'i !== j');
  _require(j >= 0, 'j below zero', { i, j }, 'j >= 0');
  _require(j < N_COINS, 'j above N_COINS', { i, j, N_COINS }, 'j < N_COINS');

  // should be unreachable, but good for safety
  _require(i >= 0, 'i below zero', { i, j }, 'i >= 0');
  _require(i < N_COINS, 'i above N_COINS', { i, j, N_COINS }, 'i < N_COINS');

  const A = state.A;
  const D = self.get_D(self, xp, A);
  const Ann = A * BI_N_COINS;
  let c = D;
  let S = 0n;
  let _x = 0n;
  let y_prev = 0n;

  for (const _i of _.range(N_COINS)) {
    if (_i === i) {
      _x = x;
    } else if (_i !== j) {
      _x = xp[_i];
    } else {
      continue;
    }
    S += _x;
    c = (c * D) / (_x * BI_N_COINS);
  }
  c = (c * D * A_PRECISION) / (Ann * BI_N_COINS);
  const b = S + (D * A_PRECISION) / Ann; // - D
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
      if (y_prev - y <= 1) {
        return y;
      }
    }
  }
  throw new Error(
    `${self.IMPLEMENTATION_NAME}: function customPlain2CoinFrax didn't converge`,
  );
};

const implementations: Record<ImplementationNames, get_y> = {
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

  [ImplementationNames.FACTORY_V1_META_BTC]: customPlain2CoinFrax,
  [ImplementationNames.FACTORY_V1_META_USD]: customPlain2CoinFrax,

  [ImplementationNames.FACTORY_META_BTC]: customPlain2CoinFrax,
  [ImplementationNames.FACTORY_META_BTC_BALANCES]: customPlain2CoinFrax,

  [ImplementationNames.FACTORY_META_BTC_REN]: customPlain2CoinFrax,
  [ImplementationNames.FACTORY_META_BTC_BALANCES_REN]: customPlain2CoinFrax,

  [ImplementationNames.FACTORY_META_USD]: customPlain2CoinFrax,
  [ImplementationNames.FACTORY_META_USD_BALANCES]: customPlain2CoinFrax,

  [ImplementationNames.FACTORY_META_USD_FRAX_USDC]: customPlain2CoinFrax,
  [ImplementationNames.FACTORY_META_USD_BALANCES_FRAX_USDC]:
    customPlain2CoinFrax,

  [ImplementationNames.FACTORY_PLAIN_2_BALANCES]: customPlain2CoinFrax,
  [ImplementationNames.FACTORY_PLAIN_2_BASIC]: customPlain2CoinFrax,
  [ImplementationNames.FACTORY_PLAIN_2_ETH]: customPlain2CoinFrax,
  [ImplementationNames.FACTORY_PLAIN_2_OPTIMIZED]: customPlain2CoinFrax,

  [ImplementationNames.FACTORY_PLAIN_3_BALANCES]: customPlain2CoinFrax,
  [ImplementationNames.FACTORY_PLAIN_3_BASIC]: customPlain2CoinFrax,
  [ImplementationNames.FACTORY_PLAIN_3_ETH]: customPlain2CoinFrax,
  [ImplementationNames.FACTORY_PLAIN_3_OPTIMIZED]: customPlain2CoinFrax,

  [ImplementationNames.FACTORY_PLAIN_4_BALANCES]: customPlain2CoinFrax,
  [ImplementationNames.FACTORY_PLAIN_4_BASIC]: customPlain2CoinFrax,
  [ImplementationNames.FACTORY_PLAIN_4_ETH]: customPlain2CoinFrax,
  [ImplementationNames.FACTORY_PLAIN_4_OPTIMIZED]: customPlain2CoinFrax,
};

export default implementations;
