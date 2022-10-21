import { PoolState } from '../../types';
import { get_D } from './get_D';
import { _A } from './_A';
import { _xp_mem } from './_xp_mem';

export interface DependantFuncs {
  _A: _A;
  get_D: get_D;
  _xp_mem: _xp_mem;
}

export type get_virtual_price = (
  state: PoolState,
  funcs: DependantFuncs,
) => bigint;

const _default = (state: PoolState, funcs: DependantFuncs): bigint => {
  const { PRECISION, rate_multipliers } = state.constants;
  const amp = funcs._A(state);
  const xp = funcs._xp_mem(state, rate_multipliers, state.balances);
  const D = funcs.get_D(state, xp, amp);

  // D is in the units similar to DAI (e.g. converted to precision 1e18)
  // When balanced, D = n * x_u - total virtual value of the portfolio
  return (D * PRECISION) / state.totalSupply;
};

export enum variations {
  DEFAULT = 'default',
}

export const mappings: Record<variations, get_virtual_price> = {
  [variations.DEFAULT]: _default,
};
