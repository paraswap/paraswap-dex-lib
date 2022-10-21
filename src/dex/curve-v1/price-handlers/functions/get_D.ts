import _ from 'lodash';
import { PoolState } from '../../types';

export type get_D = (state: PoolState, xp: bigint[], amp: bigint) => bigint;

const _default = (state: PoolState, xp: bigint[], amp: bigint): bigint => {
  const { N_COINS } = state.constants;

  let S = 0n;
  for (const _x of xp) {
    S += _x;
  }
  if (S === 0n) {
    return 0n;
  }

  let Dprev = 0n;
  let D = S;
  const Ann = amp * N_COINS;
  for (const _i of _.range(255)) {
    let D_P = D;
    for (const _x of xp) {
      // If division by 0, this will be borked: only withdrawal will work. And that is good
      D_P = (D_P * D) / (_x * N_COINS);
    }
    Dprev = D;
    D =
      ((Ann * S + D_P * N_COINS) * D) / ((Ann - 1n) * D + (N_COINS + 1n) * D_P);
    // Equality with the precision of 1
    if (D > Dprev) {
      if (D - Dprev <= 1n) {
        break;
      }
    } else {
      if (Dprev - D <= 1n) {
        break;
      }
    }
  }
  return D;
};

export enum variations {
  DEFAULT = 'default',
}

export const mappings: Record<variations, get_D> = {
  [variations.DEFAULT]: _default,
};
