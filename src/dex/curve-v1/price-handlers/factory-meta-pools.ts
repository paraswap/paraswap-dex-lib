import _ from 'lodash';
import { BI_POWS } from '../../../bigint-constants';
import { funcName, _require } from '../../../utils';
import { ICurveV1PriceHandler, PoolState } from '../types';
import { BasePool } from './base-pool';
import { CustomPlainPools } from './custom-plain-pools';

class ThreePool2_15 extends BasePool implements ICurveV1PriceHandler {
  private readonly N_COINS = 2;
  private readonly MAX_COIN = this.N_COINS - 1;
  private readonly BASE_N_COINS = 3;
  private readonly PRECISION = BI_POWS[18];

  private readonly FEE_DENOMINATOR = BI_POWS[10];

  private readonly A_PRECISION = 100n;

  private readonly _basePool = CustomPlainPools.ThreePool;

  get_dy(state: PoolState, i: number, j: number, dx: bigint): bigint {
    if (state.basePoolState?.virtualPrice === undefined) {
      throw new Error(`${funcName()}: basePoolState virtualPrice is undefined`);
    }

    const { rate_multiplier } = state.constants;
    const rates = [rate_multiplier, state.basePoolState.virtualPrice];
    const xp = this._xp_mem(rates, state.balances);

    const x = xp[i] + (dx * rates[i]) / this.PRECISION;
    const y = this.get_y(state.A, i, j, x, xp);
    const dy = xp[j] - y - 1n;
    const _fee = (state.fee * dy) / this.FEE_DENOMINATOR;
    return ((dy - _fee) * this.PRECISION) / rates[j];
  }

  get_dy_underlying(
    state: PoolState,
    i: number,
    j: number,
    dx: bigint,
  ): bigint {
    if (state.basePoolState === undefined) {
      throw new Error(
        `${funcName()}: received state with undefined basePoolState`,
      );
    }
    const { basePoolState, constants } = state;
    const rates = [constants.rate_multiplier, basePoolState.virtualPrice];
    const xp = this._xp_mem(rates, state.balances);

    let x = 0n;
    let base_i = 0;
    let base_j = 0;
    let meta_i = 0;
    let meta_j = 0;

    if (i !== 0) {
      base_i = i - this.MAX_COIN;
      meta_i = 1;
    }
    if (j !== 0) {
      base_j = j - this.MAX_COIN;
      meta_j = 1;
    }

    if (i === 0) {
      x = xp[i] + dx * (rates[0] / BI_POWS[18]);
    } else {
      if (j == 0) {
        // i is from BasePool
        // At first, get the amount of pool tokens
        const base_inputs = new Array(this.BASE_N_COINS).fill(0n);
        base_inputs[base_i] = dx;
        // Token amount transformed to underlying "dollars"
        x =
          (this._basePool.calc_token_amount(basePoolState, base_inputs, true) *
            rates[1]) /
          this.PRECISION;
        // Accounting for deposit/withdraw fees approximately
        x -= (x * basePoolState.fee) / (2n * this.FEE_DENOMINATOR);
        // Adding number of pool tokens
        x += xp[this.MAX_COIN];
      } else {
        // If both are from the base pool
        return this._basePool.get_dy(basePoolState, base_i, base_j, dx);
      }
    }

    // This pool is involved only when in-pool assets are used
    const y = this.get_y(state.A, meta_i, meta_j, x, xp);
    let dy = xp[meta_j] - y - 1n;
    dy = dy - (state.fee * dy) / this.FEE_DENOMINATOR;

    // If output is going via the metapool
    if (j == 0) {
      dy /= rates[0] / BI_POWS[18];
    } else {
      // j is from BasePool
      // The fee is already accounted for
      dy = this._basePool.calc_withdraw_one_coin(
        basePoolState,
        (dy * this.PRECISION) / rates[1],
        base_j,
      );
    }

    return dy;
  }

  private _xp_mem(_rates: bigint[], _balances: bigint[]) {
    const result = new Array(this.N_COINS).fill(0n);
    for (const i of _.range(this.N_COINS)) {
      result[i] = (_rates[i] * _balances[i]) / this.PRECISION;
    }
    return result;
  }

  private get_y(A: bigint, i: number, j: number, x: bigint, xp: bigint[]) {
    // x in the input is converted to the same price/precision
    _require(i !== j, 'same coin', { i, j }, 'i !== j');
    _require(j >= 0, 'j below zero', { i, j }, 'j >= 0');
    _require(
      j < this.N_COINS,
      'j above N_COINS',
      { i, j, N_COINS: this.N_COINS },
      'j < N_COINS',
    );

    // should be unreachable, but good for safety
    _require(i >= 0, 'i below zero', { i, j }, 'i >= 0');
    _require(
      i < this.N_COINS,
      'i above N_COINS',
      { i, j, N_COINS: this.N_COINS },
      'i < N_COINS',
    );

    const BI_N_COINS = BigInt(this.N_COINS);

    const amp = A;
    const D = this.get_D(xp, amp);
    let S_ = 0n;
    let _x = 0n;
    let y_prev = 0n;
    let c = D;
    const Ann = amp * BI_N_COINS;

    for (const _i of _.range(this.N_COINS)) {
      if (_i === i) {
        _x = x;
      } else if (_i !== j) {
        _x = xp[_i];
      } else {
        continue;
      }
      S_ += _x;
      c = (c * D) / (_x * BI_N_COINS);
    }
    c = (c * D * this.A_PRECISION) / (Ann * BI_N_COINS);
    const b = S_ + (D * this.A_PRECISION) / Ann; // - D
    let y = D;

    for (const _i of _.range(255)) {
      y_prev = y;
      y = (y * y + c) / (2n * y + b - D);
      //
      // Equality with the precision of 1
      if (y > y_prev) {
        if (y - y_prev <= 1) {
          return y;
        }
      } else {
        if (y_prev - y <= 1) {
          return y;
        }
      }
    }

    throw new Error(
      `${funcName()}: didn't converge. Error in implementation of ThreePool2_15`,
    );
  }

  private get_D(_xp: bigint[], _amp: bigint): bigint {
    let S = 0n;
    let Dprev = 0n;
    for (const x of _xp) {
      S += x;
    }
    if (S === 0n) {
      return 0n;
    }

    let D = S;
    const BI_N_COINS = BigInt(this.N_COINS);
    const Ann = _amp * BI_N_COINS;

    for (const i of _.range(255)) {
      let D_P = D;
      for (const x of _xp) {
        // If division by 0, this will be borked: only withdrawal will work. And that is good
        D_P = (D_P * D) / (x * BI_N_COINS);
      }
      Dprev = D;
      D =
        (((Ann * S) / this.A_PRECISION + D_P * BI_N_COINS) * D) /
        ((Ann - this.A_PRECISION) * D + (BI_N_COINS + 1n) * D_P);
      // Equality with the precision of 1
      if (D > Dprev) {
        if (D - Dprev <= 1n) {
          return D;
        }
      } else {
        if (Dprev - D <= 1n) {
          return D;
        }
      }
    }

    // convergence typically occurs in 4 rounds or less, this should be unreachable!
    // if it does happen the pool is borked and LPs can withdraw via `remove_liquidity`
    throw new Error(
      `${funcName()}: didn't converge. Check price implementation for ThreePool2_15`,
    );
  }
}

export const FactoryMetaPools = { ThreePool2_15: new ThreePool2_15() };
