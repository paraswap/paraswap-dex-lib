import { ImplementationNames, PoolState } from '../../types';
import { get_dx, IPoolContext } from '../types';
import { requireValue, throwNotExist } from './utils';
import _ from 'lodash';

const factoryPlain2CrvEma: get_dx = (
  self: IPoolContext,
  state: PoolState,
  i: number,
  j: number,
  dy: bigint,
) => {
  const balances = requireValue(self, state, 'balances', 'factoryPlain2CrvEma');
  const fee = requireValue(self, state, 'fee', 'factoryPlain2CrvEma');
  const { PRECISION, FEE_DENOMINATOR } = self.constants;
  const { rate_multipliers: rates } = state.constants;

  const xp = self._xp_mem(self, rates, balances);

  const y =
    xp[j] -
    (((dy * rates[j]) / PRECISION + 1n) * FEE_DENOMINATOR) /
      (FEE_DENOMINATOR - fee);
  const x = self.get_y(self, state, j, i, y, xp, 0n, 0n);

  return ((x - xp[i]) * PRECISION) / rates[i];
};

const stableNg: get_dx = (
  self: IPoolContext,
  state: PoolState,
  i: number,
  j: number,
  dy: bigint,
) => {
  const rates = requireValue(self, state, 'storedRates', 'stableNg');
  const N_COINS = requireValue(self, state, 'n_coins', 'stableNg');
  const A = requireValue(self, state, 'A', 'stableNg');
  const stateFee = requireValue(self, state, 'fee', 'stableNg');
  const offpeg_fee_multiplier = requireValue(
    self,
    state,
    'offpeg_fee_multiplier',
    'stableNg',
  );

  const { FEE_DENOMINATOR, PRECISION } = self.constants;
  const xp: bigint[] = [];
  const { balances } = state;

  for (const idx of _.range(N_COINS)) {
    xp.push((rates[idx] * balances[idx]) / PRECISION);
  }

  const amp = A;
  const D = self.get_D(self, xp, amp, N_COINS);

  const base_fee = stateFee;
  const dy_with_fee = (dy * rates[j]) / PRECISION + 1n;

  const fee_multiplier = offpeg_fee_multiplier;
  const fee = self._dynamic_fee(self, xp[i], xp[j], base_fee, fee_multiplier);

  const y = xp[j] - (dy_with_fee * FEE_DENOMINATOR) / (FEE_DENOMINATOR - fee);
  const x = self.get_y(self, state, j, i, y, xp, amp, D);

  if (y < 0n || x < 0n) {
    return 0n;
  }

  return ((x - xp[i]) * PRECISION) / rates[i];
};

const notExist: get_dx = (
  self: IPoolContext,
  state: PoolState,
  i: number,
  j: number,
  dy: bigint,
) => {
  return throwNotExist('get_dx', self.IMPLEMENTATION_NAME);
};

const implementations: Record<ImplementationNames, get_dx> = {
  [ImplementationNames.CUSTOM_PLAIN_2COIN_FRAX]: notExist,
  [ImplementationNames.CUSTOM_PLAIN_2COIN_RENBTC]: notExist,
  [ImplementationNames.CUSTOM_PLAIN_2COIN_WBTC]: notExist,
  [ImplementationNames.CUSTOM_PLAIN_3COIN_SBTC]: notExist,
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

  [ImplementationNames.FACTORY_META_BTC_SBTC2]: notExist,
  [ImplementationNames.FACTORY_META_BTC_BALANCES_SBTC2]: notExist,
  [ImplementationNames.FACTORY_PLAIN_2_BASIC_EMA]: notExist,
  [ImplementationNames.FACTORY_PLAIN_2_ETH_EMA]: notExist,
  [ImplementationNames.FACTORY_PLAIN_2_ETH_EMA2]: notExist,
  [ImplementationNames.FACTORY_PLAIN_2_CRV_EMA]: factoryPlain2CrvEma,

  [ImplementationNames.FACTORY_STABLE_NG]: stableNg,
};

export default implementations;
