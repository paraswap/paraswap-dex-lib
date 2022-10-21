import { BI_POWS } from '../../../../bigint-constants';
import { PoolState } from '../../types';
import { calc_token_amount } from './calc_token_amount';
import { get_D } from './get_D';
import { get_dy } from './get_dy';
import { get_D_mem } from './get_D_mem';
import { get_virtual_price } from './get_virtual_price';
import { get_y } from './get_y';
import { get_y_D } from './get_y_D';
import { _A } from './_A';
import { _xp } from './_xp';
import { _xp_mem } from './_xp_mem';
import { calc_withdraw_one_coin } from './calc_withdraw_one_coin';
import { _calc_withdraw_one_coin } from './_calc_withdraw_one_coin';

export interface DependantFuncs {
  _xp_mem: _xp_mem;
  get_y: get_y;
  _A: _A;
  get_D: get_D;
}

export interface BaseDependantFuncs {
  get_virtual_price: get_virtual_price;
  _A: _A;
  get_D: get_D;
  _xp_mem: _xp_mem;
  calc_token_amount: calc_token_amount;
  get_D_mem: get_D_mem;
  get_dy: get_dy;
  _xp: _xp;
  get_y: get_y;
  calc_withdraw_one_coin: calc_withdraw_one_coin;
  _calc_withdraw_one_coin: _calc_withdraw_one_coin;
  get_y_D: get_y_D;
}

export type get_dy_underlying = (
  state: PoolState,
  basePoolState: PoolState,
  funcs: DependantFuncs,
  basePoolFuncs: BaseDependantFuncs,
  i: number,
  j: number,
  dx: bigint,
) => bigint;

const _default = (
  state: PoolState,
  basePoolState: PoolState,
  funcs: DependantFuncs,
  basePoolFuncs: BaseDependantFuncs,
  i: number,
  j: number,
  dx: bigint,
): bigint => {
  const {
    rate_multiplier,
    MAX_COIN,
    BASE_N_COINS,
    PRECISION,
    FEE_DENOMINATOR,
  } = state.constants;
  const rates = [
    rate_multiplier,
    basePoolFuncs.get_virtual_price(basePoolState, basePoolFuncs),
  ];
  const xp = funcs._xp_mem(state, rates, state.balances);

  let x = 0n;
  let base_i = 0;
  let base_j = 0;
  let meta_i = 0;
  let meta_j = 0;

  if (i !== 0) {
    base_i = i - Number(MAX_COIN);
    meta_i = 1;
  }
  if (j !== 0) {
    base_j = j - Number(MAX_COIN);
    meta_j = 1;
  }

  if (i === 0) {
    x = xp[i] + dx * (rates[0] / BI_POWS[18]);
  } else {
    if (j == 0) {
      // i is from BasePool
      // At first, get the amount of pool tokens
      const base_inputs = new Array(BASE_N_COINS).fill(0n);
      base_inputs[base_i] = dx;
      // Token amount transformed to underlying "dollars"
      x =
        (basePoolFuncs.calc_token_amount(
          basePoolState,
          basePoolFuncs,
          base_inputs,
          true,
        ) *
          rates[1]) /
        PRECISION;
      // Accounting for deposit/withdraw fees approximately
      x -= (x * basePoolState.fee) / (2n * FEE_DENOMINATOR);
      // Adding number of pool tokens
      x += xp[Number(MAX_COIN)];
    } else {
      // If both are from the base pool
      return basePoolFuncs.get_dy(
        basePoolState,
        basePoolFuncs,
        base_i,
        base_j,
        dx,
      );
    }
  }

  // This pool is involved only when in-pool assets are used
  const y = funcs.get_y(state, funcs, meta_i, meta_j, x, xp);
  let dy = xp[meta_j] - y - 1n;
  dy = dy - (state.fee * dy) / FEE_DENOMINATOR;

  // If output is going via the metapool
  if (j == 0) {
    dy /= rates[0] / BI_POWS[18];
  } else {
    // j is from BasePool
    // The fee is already accounted for
    dy = basePoolFuncs.calc_withdraw_one_coin(
      basePoolState,
      basePoolFuncs,
      (dy * PRECISION) / rates[1],
      base_j,
    );
  }

  return dy;
};

export enum variations {
  DEFAULT = 'default',
}

export const mappings: Record<variations, get_dy_underlying> = {
  [variations.DEFAULT]: _default,
};
