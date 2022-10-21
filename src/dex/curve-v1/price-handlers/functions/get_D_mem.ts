import _ from 'lodash';
import { PoolState } from '../../types';
import { get_D } from './get_D';
import { _xp_mem } from './_xp_mem';

export interface DependantFuncs {
  _xp_mem: _xp_mem;
  get_D: get_D;
}

export type get_D_mem = (
  state: PoolState,
  funcs: DependantFuncs,
  _rates: bigint[],
  _balances: bigint[],
  _amp: bigint,
) => bigint;

const _default = (
  state: PoolState,
  funcs: DependantFuncs,
  _rates: bigint[],
  _balances: bigint[],
  _amp: bigint,
): bigint => {
  const xp = funcs._xp_mem(state, _rates, _balances);
  return funcs.get_D(state, xp, _amp);
};

export enum variations {
  DEFAULT = 'default',
}

export const mappings: Record<variations, get_D_mem> = {
  [variations.DEFAULT]: _default,
};
