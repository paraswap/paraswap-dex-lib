import _ from 'lodash';
import { _require } from '../../../utils';
import { PoolState } from '../types';

export abstract class BasePriceHandler {
  protected get_dy(state: PoolState, i: number, j: number, dx: bigint) {
    const { RATES, PRECISION, FEE_DENOMINATOR } = state.constants;
    const xp = this._xp(state);

    const x = xp[i] + (dx * RATES[i]) / PRECISION;
    const y = this.get_y(state, i, j, x, xp);
    const dy = ((xp[j] - y - 1n) * PRECISION) / RATES[j];
    const _fee = (state.fee * dy) / FEE_DENOMINATOR;
    return dy - _fee;
  }

  protected get_dy_underlying(
    state: PoolState,
    i: number,
    j: number,
    dx: bigint,
  ) {
    const { PRECISION_MUL, FEE_DENOMINATOR } = state.constants;
    const xp = this._xp(state);

    const x = xp[i] + dx * PRECISION_MUL[i];
    const y = this.get_y(state, i, j, x, xp);
    const dy = (xp[j] - y - 1n) / PRECISION_MUL[j];
    const _fee = (state.fee * dy) / FEE_DENOMINATOR;
    return dy - _fee;
  }

  protected _xp(state: PoolState): bigint[] {
    const { N_COINS, RATES, LENDING_PRECISION } = state.constants;

    const result = [...RATES];
    for (const i of _.range(Number(N_COINS))) {
      result[i] = (result[i] * state.balances[i]) / LENDING_PRECISION;
    }

    return result;
  }

  protected get_y(
    state: PoolState,
    i: number,
    j: number,
    x: bigint,
    xp_: bigint[],
  ): bigint {
    const { N_COINS } = state.constants;
    // x in the input is converted to the same price/precision

    _require(i !== j, 'same coin', { i, j }, 'i !== j');
    _require(j >= 0, 'j below zero', { i, j }, 'j >= 0');
    _require(j < N_COINS, 'j above N_COINS', { i, j, N_COINS }, 'j < N_COINS');

    // should be unreachable, but good for safety
    _require(i >= 0, 'i below zero', { i, j }, 'i >= 0');
    _require(i < N_COINS, 'i above N_COINS', { i, j, N_COINS }, 'i < N_COINS');

    const amp = this._A(state);
    const D = this.get_D(state, xp_, amp);
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
  }

  _A(state: PoolState): bigint {
    const t1 = state.future_A_time;
    const A1 = state.future_A;

    if (state.blockTimestamp < t1) {
      const A0 = state.initial_A;
      const t0 = state.initial_A_time;
      // Expressions in uint256 cannot have negative numbers, thus "if"
      if (A1 > A0) {
        return A0 + ((A1 - A0) * (state.blockTimestamp - t0)) / (t1 - t0);
      } else {
        return A0 - ((A0 - A1) * (state.blockTimestamp - t0)) / (t1 - t0);
      }
    } else {
      // when t1 == 0 or block.timestamp >= t1
      return A1;
    }
  }

  get_D(state: PoolState, xp: bigint[], amp: bigint): bigint {
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
        ((Ann * S + D_P * N_COINS) * D) /
        ((Ann - 1n) * D + (N_COINS + 1n) * D_P);
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
  }
}
