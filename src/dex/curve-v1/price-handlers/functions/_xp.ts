import _ from 'lodash';
import { PoolState } from '../../types';

export type _xp = (state: PoolState) => bigint[];

const _default = (state: PoolState): bigint[] => {
  const { N_COINS, rate_multipliers, LENDING_PRECISION } = state.constants;

  const result = [...rate_multipliers];
  for (const i of _.range(Number(N_COINS))) {
    result[i] = (result[i] * state.balances[i]) / LENDING_PRECISION;
  }

  return result;
};

export enum variations {
  DEFAULT = 'default',
}

export const mappings: Record<variations, _xp> = {
  [variations.DEFAULT]: _default,
};
