import { PoolState } from '../types';
import {
  calc_token_amount,
  calc_withdraw_one_coin,
  get_D,
  get_dy,
  get_dy_underlying,
  get_D_mem,
  get_y,
  get_y_D,
  IPoolContext,
  _A,
  _calc_withdraw_one_coin,
  _xp,
  _xp_mem,
} from './types';

export abstract class BasePool {
  abstract readonly IMPLEMENTATION_NAME: string;
  abstract readonly N_COINS: number;
  abstract readonly BI_N_COINS: bigint;

  abstract readonly FEE_DENOMINATOR: bigint;
  abstract readonly LENDING_PRECISION: bigint;
  abstract readonly PRECISION: bigint;
  abstract readonly PRECISION_MUL: bigint[];
  abstract readonly RATES: bigint[];
  abstract readonly A_PRECISION: bigint;

  abstract _A: _A;
  abstract _calc_withdraw_one_coin: _calc_withdraw_one_coin;
  abstract _xp_mem: _xp_mem;
  abstract _xp: _xp;
  abstract calc_token_amount: calc_token_amount;
  abstract calc_withdraw_one_coin: calc_withdraw_one_coin;
  abstract get_D_mem: get_D_mem;
  abstract get_D: get_D;
  abstract get_dy_underlying: get_dy_underlying;
  abstract get_dy: get_dy;
  abstract get_y_D: get_y_D;
  abstract get_y: get_y;
}
