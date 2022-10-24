import _ from 'lodash';
import { ImplementationNames, PoolState } from '../../types';
import { get_D } from './get_D';
import { get_y_D } from './get_y_D';
import { _A } from './_A';
import { _xp_mem } from './_xp_mem';

interface DependantFuncs {
  _A: _A;
  _xp_mem: _xp_mem;
  get_D: get_D;
  get_y_D: get_y_D;
}

export type _calc_withdraw_one_coin = (
  state: PoolState,
  funcs: DependantFuncs,
  _burn_amount: bigint,
  i: number,
) => [bigint, bigint];

const factoryPlain2CoinErc20: _calc_withdraw_one_coin = (
  state: PoolState,
  funcs: DependantFuncs,
  _burn_amount: bigint,
  i: number,
): [bigint, bigint] => {
  const { rate_multipliers, PRECISION, N_COINS, FEE_DENOMINATOR } =
    state.constants;
  const amp = funcs._A(state);
  const rates = rate_multipliers;
  const xp = funcs._xp_mem(state, rates, state.balances);
  const D0 = funcs.get_D(state, xp, amp);

  const total_supply = state.totalSupply;
  const D1 = D0 - (_burn_amount * D0) / total_supply;
  const new_y = funcs.get_y_D(state, amp, i, xp, D1);

  const base_fee = (state.fee * N_COINS) / (4n * (N_COINS - 1n));
  const xp_reduced = new Array(Number(N_COINS)).fill(0n);

  for (const j of _.range(Number(N_COINS))) {
    let dx_expected = 0n;
    const xp_j = xp[j];
    if (j === i) {
      dx_expected = (xp_j * D1) / D0 - new_y;
    } else {
      dx_expected = xp_j - (xp_j * D1) / D0;
    }
    xp_reduced[j] = xp_j - (base_fee * dx_expected) / FEE_DENOMINATOR;
  }
  let dy = xp_reduced[i] - funcs.get_y_D(state, amp, i, xp_reduced, D1);
  const dy_0 = ((xp[i] - new_y) * PRECISION) / rates[i]; // w/o fees
  dy = ((dy - 1n) * PRECISION) / rates[i]; // Withdraw less to account for rounding errors

  return [dy, dy_0 - dy];
};

const implementations: Record<ImplementationNames, _calc_withdraw_one_coin> = {
  [ImplementationNames.FACTORY_PLAIN_2COIN_ERC20]: factoryPlain2CoinErc20,
};

export default implementations;
