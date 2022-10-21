import { _xp } from './_xp';
import { get_y } from './get_y';
import { PoolState } from '../../types';
import { _A } from './_A';
import { get_D } from './get_D';

export interface DependantFuncs {
  _xp: _xp;
  get_y: get_y;
  _A: _A;
  get_D: get_D;
}

export type get_dy = (
  state: PoolState,
  funcs: DependantFuncs,
  i: number,
  j: number,
  dx: bigint,
) => bigint;

const _default = (
  state: PoolState,
  funcs: DependantFuncs,
  i: number,
  j: number,
  dx: bigint,
): bigint => {
  const { rate_multipliers, PRECISION, FEE_DENOMINATOR } = state.constants;
  const xp = funcs._xp(state);

  const x = xp[i] + (dx * rate_multipliers[i]) / PRECISION;
  const y = funcs.get_y(state, funcs, i, j, x, xp);
  const dy = ((xp[j] - y - 1n) * PRECISION) / rate_multipliers[j];
  const _fee = (state.fee * dy) / FEE_DENOMINATOR;
  return dy - _fee;
};

export enum variations {
  DEFAULT = 'default',
}

export const mappings: Record<variations, get_dy> = {
  [variations.DEFAULT]: _default,
};
