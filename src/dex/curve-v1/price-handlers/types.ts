import { PoolState } from '../types';

export type _A = (state: PoolState) => bigint;

export type _calc_withdraw_one_coin = (
  self: IPoolContext,
  state: PoolState,
  _burn_amount: bigint,
  i: number,
) => [bigint, bigint];

export type _xp_mem = (
  state: PoolState,
  _rates: bigint[],
  _balances: bigint[],
) => bigint[];

export type _xp = (
  state: PoolState,
  _rates: bigint[],
  _balances: bigint[],
) => bigint[];

export type calc_token_amount = (
  state: PoolState,
  _amounts: bigint[],
  _is_deposit: boolean,
) => bigint;

export type calc_withdraw_one_coin = (
  state: PoolState,
  _burn_amount: bigint,
  i: number,
) => bigint;

export type get_D_mem = (
  state: PoolState,
  _rates: bigint[],
  _balances: bigint[],
  _amp: bigint,
) => bigint;

export type get_D = (state: PoolState, xp: bigint[], amp: bigint) => bigint;

export type get_dy_underlying = (
  self: IPoolContext,
  _basePool: IPoolContext,
  state: PoolState,
  basePoolState: PoolState,
  i: number,
  j: number,
  dx: bigint,
) => bigint;

export type get_dy = (
  state: PoolState,
  i: number,
  j: number,
  dx: bigint,
  basePoolVirtualPrice?: bigint,
) => bigint;

export type get_y_D = (
  state: PoolState,
  A: bigint,
  i: number,
  xp: bigint[],
  D: bigint,
) => bigint;

export type get_y = (
  state: PoolState,
  i: number,
  j: number,
  x: bigint,
  xp_: bigint[],
) => bigint;

export interface IPoolContext {
  readonly IMPLEMENTATION_NAME: string;
  readonly N_COINS: number;
  readonly BI_N_COINS: bigint;

  readonly FEE_DENOMINATOR: bigint;
  readonly LENDING_PRECISION: bigint;
  readonly PRECISION: bigint;
  readonly PRECISION_MUL: bigint[];
  readonly RATES: bigint[];
  readonly A_PRECISION: bigint;

  _A: _A;
  _calc_withdraw_one_coin: _calc_withdraw_one_coin;
  _xp_mem: _xp_mem;
  _xp: _xp;
  calc_token_amount: calc_token_amount;
  calc_withdraw_one_coin: calc_withdraw_one_coin;
  get_D_mem: get_D_mem;
  get_D: get_D;
  get_dy_underlying: get_dy_underlying;
  get_dy: get_dy;
  get_y_D: get_y_D;
  get_y: get_y;
}
