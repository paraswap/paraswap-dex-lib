import _ from 'lodash';
import { PoolState } from '../../types';
import { _require } from '../../../../utils';
import { _A } from './_A';
import { get_D } from './get_D';

const _default = (
  state: PoolState,
  funcs: DependantFuncs,
  i: number,
  j: number,
  x: bigint,
  xp_: bigint[],
): bigint => {
  const { N_COINS } = state.constants;
  // x in the input is converted to the same price/precision

  _require(i !== j, 'same coin', { i, j }, 'i !== j');
  _require(j >= 0, 'j below zero', { i, j }, 'j >= 0');
  _require(j < N_COINS, 'j above N_COINS', { i, j, N_COINS }, 'j < N_COINS');

  // should be unreachable, but good for safety
  _require(i >= 0, 'i below zero', { i, j }, 'i >= 0');
  _require(i < N_COINS, 'i above N_COINS', { i, j, N_COINS }, 'i < N_COINS');

  const amp = funcs._A(state);
  const D = funcs.get_D(state, xp_, amp);
  let c = D;
  let S_ = 0n;
  const Ann = amp * N_COINS;

  let _x = 0n;
  for (const _i of _.range(Number(N_COINS))) {
    if (_i === i) {
      _x = x;
    } else if (_i !== j) {
      _x = xp_[_i];
    } else {
      continue;
    }
    S_ += _x;
    c = (c * D) / (_x * N_COINS);
  }
  c = (c * D) / (Ann * N_COINS);
  const b = S_ + D / Ann; // - D
  let y_prev = 0n;
  let y = D;

  for (const _i of _.range(255)) {
    y_prev = y;
    y = (y * y + c) / (2n * y + b - D);
    //
    // Equality with the precision of 1
    if (y > y_prev) {
      if (y - y_prev <= 1) {
        break;
      }
    } else {
      if (y_prev - y <= 1) {
        break;
      }
    }
  }
  return y;
};

const implementations: Record<ImplementationNames, get_y> = {
  [ImplementationNames.FACTORY_PLAIN_2COIN_ERC20]: _default,
};

export default implementations;
