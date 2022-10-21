import _ from 'lodash';
import { PoolState } from '../../types';

export type _xp_mem = (
  state: PoolState,
  _rates: bigint[],
  _balances: bigint[],
) => bigint[];

const _default = (
  state: PoolState,
  _rates: bigint[],
  _balances: bigint[],
): bigint[] => {
  const { N_COINS, PRECISION } = state.constants;

  const result = new Array(N_COINS);
  for (const i of _.range(Number(N_COINS))) {
    result[i] = (_rates[i] * _balances[i]) / PRECISION;
  }
  return result;
};

export enum variations {
  DEFAULT = 'default',
}

export const mappings: Record<variations, _xp_mem> = {
  [variations.DEFAULT]: _default,
};
