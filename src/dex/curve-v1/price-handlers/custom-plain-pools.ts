import _ from 'lodash';
import { BI_POWS } from '../../../bigint-constants';
import { funcName, _require } from '../../../utils';
import { ICurveV1PriceHandler, PoolState } from '../types';
import { BasePool } from './base-pool';

export class ThreePool extends BasePool implements ICurveV1PriceHandler {
  private readonly N_COINS = 3;
  private readonly BI_N_COINS = BigInt(this.N_COINS);

  private readonly FEE_DENOMINATOR = BI_POWS[10];
  private readonly LENDING_PRECISION = BI_POWS[18];
  private readonly PRECISION = BI_POWS[18];
  private readonly PRECISION_MUL = [1n, 1000000000000n, 1000000000000n];
  // Just copied from original implementation
  private readonly RATES = [
    1000000000000000000n,
    1000000000000000000000000000000n,
    1000000000000000000000000000000n,
  ];

  get_dy(state: PoolState, i: number, j: number, dx: bigint): bigint {
    const rates = [...this.RATES];
    const xp = this._xp(state);

    const x = xp[i] + (dx * rates[i]) / this.PRECISION;
    const y = this.get_y(state.A, i, j, x, xp);
    const dy = ((xp[j] - y - 1n) * this.PRECISION) / rates[j];
    const _fee = (state.fee * dy) / this.FEE_DENOMINATOR;
    return dy - _fee;
  }

  calc_token_amount(
    state: PoolState,
    amounts: bigint[],
    deposit: boolean,
  ): bigint {
    const _balances = [...state.balances];
    const amp = state.A;
    const D0 = this.get_D_mem(_balances, amp);
    for (const i of _.range(this.N_COINS)) {
      if (deposit) _balances[i] += amounts[i];
      else _balances[i] -= amounts[i];
    }
    const D1 = this.get_D_mem(_balances, amp);
    const token_amount = state.totalSupply;
    let diff = 0n;
    if (deposit) {
      diff = D1 - D0;
    } else {
      diff = D0 - D1;
    }
    return (diff * token_amount) / D0;
  }

  calc_withdraw_one_coin(state: PoolState, _token_amount: bigint, i: number) {
    return this._calc_withdraw_one_coin(state, _token_amount, i)[0];
  }

  private get_D_mem(_balances: bigint[], amp: bigint) {
    return this.get_D(this._xp_mem(_balances), amp);
  }

  private _calc_withdraw_one_coin(
    state: PoolState,
    _token_amount: bigint,
    i: number,
  ): [bigint, bigint] {
    const amp = state.A;
    const _fee = (state.fee * this.BI_N_COINS) / (4n * (this.BI_N_COINS - 1n));
    const precisions = [...this.PRECISION_MUL];
    const total_supply = state.totalSupply;

    const xp = this._xp(state);

    const D0 = this.get_D(xp, amp);
    const D1 = D0 - (_token_amount * D0) / total_supply;
    const xp_reduced = [...xp];

    const new_y = this.get_y_D(amp, i, xp, D1);

    const dy_0 = (xp[i] - new_y) / precisions[i]; // w/o fees

    for (const j of _.range(this.N_COINS)) {
      let dx_expected = 0n;
      if (j === i) {
        dx_expected = (xp[j] * D1) / D0 - new_y;
      } else {
        dx_expected = xp[j] - (xp[j] * D1) / D0;
      }
      xp_reduced[j] -= (_fee * dx_expected) / this.FEE_DENOMINATOR;
    }
    let dy = xp_reduced[i] - this.get_y_D(amp, i, xp_reduced, D1);
    dy = (dy - 1n) / precisions[i]; // Withdraw less to account for rounding errors

    return [dy, dy_0 - dy];
  }

  private _xp(state: PoolState) {
    const result = [...this.RATES];
    for (const i of _.range(this.N_COINS)) {
      result[i] = (result[i] * state.balances[i]) / this.LENDING_PRECISION;
    }
    return result;
  }

  private _xp_mem(_balances: bigint[]): bigint[] {
    const result = [...this.RATES];
    for (const i of _.range(this.N_COINS)) {
      result[i] = (result[i] * _balances[i]) / this.PRECISION;
    }
    return result;
  }

  private get_y(A: bigint, i: number, j: number, x: bigint, xp_: bigint[]) {
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
    const D = this.get_D(xp_, amp);
    let c = D;
    let S_ = 0n;
    const Ann = amp * BI_N_COINS;

    let _x = 0n;
    for (const _i of _.range(this.N_COINS)) {
      if (_i === i) {
        _x = x;
      } else if (_i !== j) {
        _x = xp_[_i];
      } else {
        continue;
      }
      S_ += _x;
      c = (c * D) / (_x * BI_N_COINS);
    }
    c = (c * D) / (Ann * BI_N_COINS);
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

  private get_D(xp: bigint[], amp: bigint): bigint {
    let S = 0n;
    for (const _x of xp) {
      S += _x;
    }
    if (S === 0n) {
      return 0n;
    }

    let Dprev = 0n;
    let D = S;
    const Ann = amp * this.BI_N_COINS;
    for (const _i of _.range(255)) {
      let D_P = D;
      for (const _x of xp) {
        // If division by 0, this will be borked: only withdrawal will work. And that is good
        D_P = (D_P * D) / (_x * this.BI_N_COINS);
      }
      Dprev = D;
      D =
        ((Ann * S + D_P * this.BI_N_COINS) * D) /
        ((Ann - 1n) * D + (this.BI_N_COINS + 1n) * D_P);
      // Equality with the precision of 1
      if (D > Dprev) {
        if (D - Dprev <= 1n) {
          break;
        } else {
          if (Dprev - D <= 1n) {
            break;
          }
        }
      }
    }
    return D;
  }

  private get_y_D(A_: bigint, i: number, xp: bigint[], D: bigint) {
    _require(i >= 0, 'i below zero', { A_, i, xp, D }, 'i >== 0');
    _require(
      i < this.N_COINS,
      'i above N_COINS',
      { A_, i, xp, D },
      'i < N_COINS',
    );

    let c = D;
    let S_ = 0n;
    const Ann = A_ * this.BI_N_COINS;

    let _x = 0n;

    for (const _i of _.range(this.N_COINS)) {
      if (_i !== i) {
        _x = xp[_i];
      } else {
        continue;
      }
      S_ += _x;
      c = (c * D) / (_x * this.BI_N_COINS);
    }
    c = (c * D) / (Ann * this.BI_N_COINS);
    const b = S_ + D / Ann;

    let y_prev = 0n;
    let y = D;

    for (const _i of _.range(255)) {
      y_prev = y;
      y = (y * y + c) / (2n * y + b - D);
      // Equality with the precision of 1
      if (y > y_prev) {
        if (y - y_prev <= 1) {
          break;
        }
      } else {
        if (y_prev - y <= 1n) {
          break;
        }
      }
    }
    return y;
  }
}

export class FraxPool extends BasePool implements ICurveV1PriceHandler {
  private readonly N_COINS = 2;
  private readonly BI_N_COINS = BigInt(this.N_COINS);
  private readonly PRECISION_MUL = [1n, 1000000000000n];
  private readonly RATES = [
    1000000000000000000n,
    1000000000000000000000000000000n,
  ];

  private readonly FEE_DENOMINATOR = BI_POWS[10];
  private readonly PRECISION = BI_POWS[18];
  private readonly A_PRECISION = 100n;

  get_dy(state: PoolState, i: number, j: number, _dx: bigint): bigint {
    const xp = this._xp(state);
    const rates = [...this.RATES];

    const x = xp[i] + (_dx * rates[i]) / this.PRECISION;
    const y = this._get_y(state.A, i, j, x, xp);
    const dy = xp[j] - y - 1n;
    const fee = (state.fee * dy) / this.FEE_DENOMINATOR;
    return ((dy - fee) * this.PRECISION) / rates[j];
  }

  calc_token_amount(
    state: PoolState,
    _amounts: bigint[],
    _is_deposit: boolean,
  ): bigint {
    const amp = state.A;
    const balances = [...state.balances];
    const D0 = this.get_D_mem(balances, amp);
    for (const i of _.range(this.N_COINS)) {
      if (_is_deposit) balances[i] += _amounts[i];
      else balances[i] -= _amounts[i];
    }
    const D1 = this.get_D_mem(balances, amp);
    const token_amount = state.totalSupply;
    let diff = 0n;
    if (_is_deposit) {
      diff = D1 - D0;
    } else {
      diff = D0 - D1;
    }
    return (diff * token_amount) / D0;
  }

  calc_withdraw_one_coin(state: PoolState, _token_amount: bigint, i: number) {
    return this._calc_withdraw_one_coin(state, _token_amount, i)[0];
  }

  private get_D_mem(_balances: bigint[], amp: bigint) {
    return this._get_D(this._xp_mem(_balances), amp);
  }

  private _calc_withdraw_one_coin(
    state: PoolState,
    _token_amount: bigint,
    i: number,
  ): [bigint, bigint, bigint] {
    const amp = state.A;
    const xp = this._xp(state);
    const D0 = this._get_D(xp, amp);

    const total_supply = state.totalSupply;
    const D1 = D0 - (_token_amount * D0) / total_supply;
    const new_y = this._get_y_D(amp, i, xp, D1);
    const xp_reduced = [...xp];
    const fee = (state.fee * this.BI_N_COINS) / (4n * (this.BI_N_COINS - 1n));

    for (const j of _.range(this.N_COINS)) {
      let dx_expected = 0n;
      if (j === i) {
        dx_expected = (xp[j] * D1) / D0 - new_y;
      } else {
        dx_expected = xp[j] - (xp[j] * D1) / D0;
      }
      xp_reduced[j] -= (fee * dx_expected) / this.FEE_DENOMINATOR;
    }
    let dy = xp_reduced[i] - this._get_y_D(amp, i, xp_reduced, D1);
    const precisions = [...this.PRECISION_MUL];
    dy = (dy - 1n) / precisions[i]; // Withdraw less to account for rounding errors
    const dy_0 = (xp[i] - new_y) / precisions[i]; // w/o fees

    return [dy, dy_0 - dy, total_supply];
  }

  private _get_y_D(A: bigint, i: number, _xp: bigint[], D: bigint): bigint {
    _require(i >= 0, 'i below zero', { A_: A, i, xp: _xp, D }, 'i >== 0');
    _require(
      i < this.N_COINS,
      'i above N_COINS',
      { A_: A, i, xp: _xp, D },
      'i < N_COINS',
    );

    const Ann = A * this.BI_N_COINS;
    let c = D;
    let S = 0n;
    let _x = 0n;
    let y_prev = 0n;

    for (const _i of _.range(this.N_COINS)) {
      if (_i !== i) {
        _x = _xp[_i];
      } else {
        continue;
      }
      S += _x;
      c = (c * D) / (_x * this.BI_N_COINS);
    }
    c = (c * D * this.A_PRECISION) / (Ann * this.BI_N_COINS);
    const b = S + (D * this.A_PRECISION) / Ann;
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
    throw new Error(
      `${this.CLASS_NAME}: function ${funcName()} didn't converge`,
    );
  }

  private _xp_mem(_balances: bigint[]): bigint[] {
    const result = [...this.RATES];
    for (const i of _.range(this.N_COINS)) {
      result[i] = (result[i] * _balances[i]) / this.PRECISION;
    }
    return result;
  }

  private _get_y(A: bigint, i: number, j: number, x: bigint, _xp: bigint[]) {
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

    const D = this._get_D(_xp, A);
    const Ann = A * BI_N_COINS;
    let c = D;
    let S = 0n;
    let _x = 0n;
    let y_prev = 0n;

    for (const _i of _.range(this.N_COINS)) {
      if (_i === i) {
        _x = x;
      } else if (_i !== j) {
        _x = _xp[_i];
      } else {
        continue;
      }
      S += _x;
      c = (c * D) / (_x * BI_N_COINS);
    }
    c = (c * D * this.A_PRECISION) / (Ann * BI_N_COINS);
    const b = S + (D * this.A_PRECISION) / Ann; // - D
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
        if (y_prev - y <= 1) {
          return y;
        }
      }
    }
    throw new Error(
      `${this.CLASS_NAME}: function ${funcName()} didn't converge`,
    );
  }

  private _get_D(_xp: bigint[], _amp: bigint): bigint {
    let S = 0n;
    let Dprev = 0n;

    for (const _x of _xp) {
      S += _x;
    }
    if (S === 0n) {
      return 0n;
    }

    let D = S;
    const Ann = _amp * this.BI_N_COINS;
    for (const _i of _.range(255)) {
      let D_P = D;
      for (const _x of _xp) {
        // If division by 0, this will be borked: only withdrawal will work. And that is good
        D_P = (D_P * D) / (_x * this.BI_N_COINS);
      }
      Dprev = D;
      D =
        (((Ann * S) / this.A_PRECISION + D_P * this.BI_N_COINS) * D) /
        (((Ann - this.A_PRECISION) * D) / this.A_PRECISION +
          (this.BI_N_COINS + 1n) * D_P);
      // Equality with the precision of 1
      if (D > Dprev) {
        if (D - Dprev <= 1n) {
          return D;
        } else {
          if (Dprev - D <= 1n) {
            return D;
          }
        }
      }
    }

    // convergence typically occurs in 4 rounds or less, this should be unreachable!
    // if it does happen the pool is borked and LPs can withdraw via `remove_liquidity`
    throw new Error(
      `${this.CLASS_NAME}: function ${funcName()} didn't converge`,
    );
  }

  private _xp(state: PoolState) {
    const result = [...this.RATES];
    for (const i of _.range(this.N_COINS)) {
      result[i] = (result[i] * state.balances[i]) / this.PRECISION;
    }
    return result;
  }
}

export class BTCPool extends BasePool implements ICurveV1PriceHandler {
  private readonly N_COINS = 3;
  private readonly BI_N_COINS = BigInt(this.N_COINS);

  private readonly USE_LENDING = [true, false, false];

  private readonly FEE_DENOMINATOR = BI_POWS[10];
  private readonly LENDING_PRECISION = BI_POWS[18];
  private readonly PRECISION = BI_POWS[18];
  private readonly PRECISION_MUL = [10000000000n, 10000000000n, 1n];

  get_dy(state: PoolState, i: number, j: number, dx: bigint): bigint {
    const rates = this._rates(state);
    const xp = this._xp(state, rates);

    const x = xp[i] + (dx * rates[i]) / this.PRECISION;
    const y = this.get_y(state.A, i, j, x, xp);
    const dy = ((xp[j] - y - 1n) * this.PRECISION) / rates[j];
    const _fee = (state.fee * dy) / this.FEE_DENOMINATOR;
    return dy - _fee;
  }

  private get_y(A: bigint, i: number, j: number, x: bigint, _xp: bigint[]) {
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
    const D = this.get_D(_xp, amp);
    let c = D;
    let S_ = 0n;
    const Ann = amp * BI_N_COINS;

    let _x = 0n;
    for (const _i of _.range(this.N_COINS)) {
      if (_i === i) {
        _x = x;
      } else if (_i !== j) {
        _x = _xp[_i];
      } else {
        continue;
      }
      S_ += _x;
      c = (c * D) / (_x * BI_N_COINS);
    }
    c = (c * D) / (Ann * BI_N_COINS);
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

  private _xp(state: PoolState, rates: bigint[]) {
    const result = [...rates];
    for (const i of _.range(this.N_COINS)) {
      result[i] = (result[i] * state.balances[i]) / this.LENDING_PRECISION;
    }
    return result;
  }

  _rates(state: PoolState) {
    const result = [...this.PRECISION_MUL];
    const use_lending = [...this.USE_LENDING];
    for (const i of _.range(this.N_COINS)) {
      let rate = this.LENDING_PRECISION; // Used with no lending
      if (use_lending[i]) rate = state.exchangeRateCurrent[i];
      result[i] *= rate;
    }
    return result;
  }
}

export const CustomPlainPools = {
  FraxPool: new FraxPool(),
  ThreePool: new ThreePool(),
  BTCPool: new BTCPool(),
};
