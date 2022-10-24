import _ from 'lodash';
import { funcName, _require } from '../../../../utils';
import { PoolState } from '../../types';

export type get_y_D = (
  state: PoolState,
  A: bigint,
  i: number,
  xp: bigint[],
  D: bigint,
) => bigint;

const _default: get_y_D = (
  state: PoolState,
  A: bigint,
  i: number,
  xp: bigint[],
  D: bigint,
): bigint => {
  const { N_COINS, A_PRECISION } = state.constants;

  _require(i >= 0, 'i below zero', { state, A, i, xp, D }, 'i >== 0');
  _require(
    i < N_COINS,
    'i above N_COINS',
    { state, A, i, xp, D },
    'i < N_COINS',
  );

  let S_ = 0n;
  let _x = 0n;
  let y_prev = 0n;
  let c = D;
  const Ann = A * N_COINS;

  for (const _i of _.range(Number(N_COINS))) {
    if (_i !== i) {
      _x = xp[_i];
    } else {
      continue;
    }
    S_ += _x;
    c = (c * D) / (_x * N_COINS);
  }
  c = (c * D * A_PRECISION) / (Ann * N_COINS);
  const b = S_ + (D * A_PRECISION) / Ann;
  let y = D;

  for (const _i of _.range(255)) {
    y_prev = y;
    y = (y * y + c) / (2n * y + b - D);
    // Equality with the precision of 1
    if (y > y_prev) {
      if (y - y_prev <= 1) {
        return y;
      }
    } else {
      if (y_prev - y <= 1n) {
        return y;
      }
    }
  }

  throw new Error(`${funcName()}: didn't converge. Throwing`);
};

const implementations: Record<ImplementationNames, get_y_D> = {
  [ImplementationNames.FACTORY_PLAIN_2COIN_ERC20]: _default,
};

export default implementations;
