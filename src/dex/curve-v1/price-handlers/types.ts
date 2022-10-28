import { ImplementationNames, PoolContextConstants, PoolState } from '../types';

export type _calc_withdraw_one_coin = (
  self: IPoolContext,
  state: PoolState,
  _burn_amount: bigint,
  i: number,
) => [bigint, bigint];

export type _rates = (self: IPoolContext, state: PoolState) => bigint[];

export type _xp_mem = (
  self: IPoolContext,
  state: PoolState,
  _rates: bigint[],
  _balances: bigint[],
) => bigint[];

export type _xp = (
  self: IPoolContext,
  state: PoolState,
  _rates: bigint[],
  _balances: bigint[],
) => bigint[];

export type calc_token_amount = (
  self: IPoolContext,
  state: PoolState,
  _amounts: bigint[],
  _is_deposit: boolean,
) => bigint;

export type calc_withdraw_one_coin = (
  self: IPoolContext,
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

export type get_D = (
  self: IPoolContext,
  state: PoolState,
  xp: bigint[],
  amp: bigint,
) => bigint;

export type get_dy_underlying = (
  self: IPoolContext,
  state: PoolState,
  i: number,
  j: number,
  dx: bigint,
) => bigint;

export type get_dy = (
  self: IPoolContext,
  state: PoolState,
  i: number,
  j: number,
  dx: bigint,
) => bigint;

export type get_y_D = (
  self: IPoolContext,
  state: PoolState,
  A: bigint,
  i: number,
  xp: bigint[],
  D: bigint,
) => bigint;

export type get_y = (
  self: IPoolContext,
  state: PoolState,
  i: number,
  j: number,
  x: bigint,
  xp_: bigint[],
) => bigint;

export interface IPoolContext {
  readonly _basePool?: IPoolContext;

  readonly IMPLEMENTATION_NAME: ImplementationNames;

  readonly constants: PoolContextConstants;

  _calc_withdraw_one_coin: _calc_withdraw_one_coin;
  _rates: _rates;
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
