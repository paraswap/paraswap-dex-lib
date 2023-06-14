import _ from 'lodash';
import { ImplementationNames, PoolState } from '../../types';
import { IPoolContext, _calc_withdraw_one_coin } from '../types';
import { requireConstant, requireValue, throwNotImplemented } from './utils';

const customPlain3CoinThree: _calc_withdraw_one_coin = (
  self: IPoolContext,
  state: PoolState,
  _token_amount: bigint,
  i: number,
) => {
  const { N_COINS, BI_N_COINS, FEE_DENOMINATOR } = self.constants;
  const PRECISION_MUL = requireConstant(
    self,
    'PRECISION_MUL',
    'customPlain3CoinThree',
  );

  if (state.totalSupply === undefined) {
    throw new Error(
      `${self.IMPLEMENTATION_NAME} customPlain3CoinThree: totalSupply is not provided`,
    );
  }

  const amp = state.A;
  const _fee = (state.fee * BI_N_COINS) / (4n * (BI_N_COINS - 1n));
  const precisions = [...PRECISION_MUL];
  const total_supply = state.totalSupply;

  const xp = self._xp(self, state);

  const D0 = self.get_D(self, xp, amp);
  const D1 = D0 - (_token_amount * D0) / total_supply;
  const xp_reduced = [...xp];

  const new_y = self.get_y_D(self, amp, i, xp, D1);

  const dy_0 = (xp[i] - new_y) / precisions[i]; // w/o fees

  for (const j of _.range(N_COINS)) {
    let dx_expected = 0n;
    if (j === i) {
      dx_expected = (xp[j] * D1) / D0 - new_y;
    } else {
      dx_expected = xp[j] - (xp[j] * D1) / D0;
    }
    xp_reduced[j] -= (_fee * dx_expected) / FEE_DENOMINATOR;
  }
  let dy = xp_reduced[i] - self.get_y_D(self, amp, i, xp_reduced, D1);
  dy = (dy - 1n) / precisions[i]; // Withdraw less to account for rounding errors

  return [dy, dy_0 - dy, undefined];
};

const customArbitrum2CoinBtc: _calc_withdraw_one_coin = (
  self: IPoolContext,
  state: PoolState,
  _token_amount: bigint,
  i: number,
) => {
  const { N_COINS, BI_N_COINS, FEE_DENOMINATOR, PRECISION } = self.constants;
  if (state.totalSupply === undefined) {
    throw new Error(
      `${self.IMPLEMENTATION_NAME} customArbitrum2CoinBtc: totalSupply is not provided`,
    );
  }

  const amp = state.A;
  const rates = [...state.constants.rate_multipliers];

  const xp = self._xp_mem(self, rates, state.balances);
  const D0 = self.get_D(self, xp, amp);

  const total_supply = state.totalSupply;
  const D1 = D0 - (_token_amount * D0) / total_supply;
  const new_y = self.get_y_D(self, amp, i, xp, D1);

  const base_fee = (state.fee * BI_N_COINS) / (4n * (BI_N_COINS - 1n));
  const xp_reduced = new Array(N_COINS).fill(0n);

  for (const j of _.range(N_COINS)) {
    let dx_expected = 0n;
    const xp_j = xp[j];
    if (j === i) {
      dx_expected = (xp_j * D1) / D0 - new_y;
    } else {
      dx_expected = xp_j - (xp_j * D1) / D0;
    }
    xp_reduced[j] = xp_j - (base_fee * dx_expected) / FEE_DENOMINATOR;
  }

  let dy = xp_reduced[i] - self.get_y_D(self, amp, i, xp_reduced, D1);
  const dy_0 = ((xp[i] - new_y) * PRECISION) / rates[i]; // w/o fees
  dy = ((dy - 1n) * PRECISION) / rates[i]; // Withdraw less to account for rounding errors

  return [dy, dy_0 - dy, undefined];
};

const customAvalanche3CoinLending: _calc_withdraw_one_coin = (
  self: IPoolContext,
  state: PoolState,
  _token_amount: bigint,
  i: number,
) => {
  const { N_COINS, BI_N_COINS, FEE_DENOMINATOR } = self.constants;
  const PRECISION_MUL = requireConstant(
    self,
    'PRECISION_MUL',
    'customAvalanche3CoinLending',
  );
  const offpeg_fee_multiplier = requireValue(
    self,
    state,
    'offpeg_fee_multiplier',
    'customAvalanche3CoinLending',
  );

  if (state.totalSupply === undefined) {
    throw new Error(
      `${self.IMPLEMENTATION_NAME} customAvalanche3CoinLending: totalSupply is not provided`,
    );
  }

  const amp = state.A;
  const xp = [...state.balances];
  const precisions = [...PRECISION_MUL];

  for (const j of _.range(N_COINS)) {
    xp[j] *= precisions[j];
  }

  const D0 = self.get_D(self, xp, amp);
  const D1 = D0 - (_token_amount * D0) / state.totalSupply;
  const new_y = self.get_y_D(self, amp, i, xp, D1);

  const xp_reduced = xp;
  const ys = (D0 + D1) / (2n * BI_N_COINS);

  const _fee = (state.fee * BI_N_COINS) / (4n * (BI_N_COINS - 1n));
  const feemul = offpeg_fee_multiplier;
  for (const j of _.range(N_COINS)) {
    let dx_expected = 0n;
    let xavg = 0n;
    if (j === i) {
      dx_expected = (xp[j] * D1) / D0 - new_y;
      xavg = (xp[j] + new_y) / 2n;
    } else {
      dx_expected = xp[j] - (xp[j] * D1) / D0;
      xavg = xp[j];
    }
    xp_reduced[j] -=
      (self._dynamic_fee(self, xavg, ys, _fee, feemul) * dx_expected) /
      FEE_DENOMINATOR;
  }
  const dy = xp_reduced[i] - self.get_y_D(self, amp, i, xp_reduced, D1);

  return [(dy - 1n) / precisions[i], undefined, undefined];
};

const customFantom2CoinBtc: _calc_withdraw_one_coin = (
  self: IPoolContext,
  state: PoolState,
  _token_amount: bigint,
  i: number,
) => {
  if (state.totalSupply === undefined) {
    throw new Error(
      `${self.IMPLEMENTATION_NAME} customFantom2CoinBtc: totalSupply is not provided`,
    );
  }
  const result = customPlain3CoinThree(self, state, _token_amount, i);
  return [result[0], result[1], state.totalSupply];
};

const notImplemented: _calc_withdraw_one_coin = (
  self: IPoolContext,
  state: PoolState,
  _token_amount: bigint,
  i: number,
) => {
  return throwNotImplemented(
    '_calc_withdraw_one_coin',
    self.IMPLEMENTATION_NAME,
  );
};

const implementations: Record<ImplementationNames, _calc_withdraw_one_coin> = {
  [ImplementationNames.CUSTOM_PLAIN_2COIN_FRAX]: customPlain3CoinThree,
  [ImplementationNames.CUSTOM_PLAIN_2COIN_RENBTC]: customPlain3CoinThree,
  [ImplementationNames.CUSTOM_PLAIN_2COIN_WBTC]: customFantom2CoinBtc,
  [ImplementationNames.CUSTOM_PLAIN_3COIN_SBTC]: customPlain3CoinThree,
  [ImplementationNames.CUSTOM_PLAIN_3COIN_THREE]: customPlain3CoinThree,

  [ImplementationNames.CUSTOM_ARBITRUM_2COIN_BTC]: customArbitrum2CoinBtc,
  [ImplementationNames.CUSTOM_ARBITRUM_2COIN_USD]: customArbitrum2CoinBtc,

  [ImplementationNames.CUSTOM_AVALANCHE_3COIN_LENDING]:
    customAvalanche3CoinLending,

  [ImplementationNames.CUSTOM_FANTOM_2COIN_BTC]: customFantom2CoinBtc,
  [ImplementationNames.CUSTOM_FANTOM_2COIN_USD]: customFantom2CoinBtc,
  [ImplementationNames.CUSTOM_FANTOM_3COIN_LENDING]:
    customAvalanche3CoinLending,

  [ImplementationNames.CUSTOM_OPTIMISM_3COIN_USD]: customArbitrum2CoinBtc,

  [ImplementationNames.CUSTOM_POLYGON_2COIN_LENDING]:
    customAvalanche3CoinLending,
  [ImplementationNames.CUSTOM_POLYGON_3COIN_LENDING]:
    customAvalanche3CoinLending,

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
  [ImplementationNames.FACTORY_PLAIN_2_BASIC]: customArbitrum2CoinBtc,
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

  [ImplementationNames.FACTORY_META_BTC_SBTC2]: ,
  [ImplementationNames.FACTORY_META_BTC_BALANCES_SBTC2]: ,
  [ImplementationNames.FACTORY_PLAIN_2_BASIC_EMA]: ,
  [ImplementationNames.FACTORY_PLAIN_2_ETH_EMA]: ,
  [ImplementationNames.FACTORY_PLAIN_2_ETH_EMA2]: ,
};

export default implementations;
