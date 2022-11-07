import { ImplementationNames, PoolContextConstants, PoolState } from '../types';

export type _calc_withdraw_one_coin = (
  self: IPoolContext,
  state: PoolState,
  _token_amount: bigint,
  i: number,
) => [bigint, bigint | undefined, bigint | undefined];

export type _dynamic_fee = (
  self: IPoolContext,
  xpi: bigint,
  xpj: bigint,
  _fee: bigint,
  _feemul: bigint,
) => bigint;

export type _rates = (self: IPoolContext, state: PoolState) => bigint[];

export type _xp_mem = (
  self: IPoolContext,
  _rates: bigint[],
  _balances: bigint[],
) => bigint[];

export type _xp = (self: IPoolContext, state: PoolState) => bigint[];

export type calc_token_amount = (
  self: IPoolContext,
  state: PoolState,
  amounts: bigint[],
  is_deposit: boolean,
) => bigint;

export type calc_withdraw_one_coin = (
  self: IPoolContext,
  state: PoolState,
  _token_amount: bigint,
  i: number,
) => bigint;

export type get_D_mem = (
  self: IPoolContext,
  state: PoolState,
  _balances: bigint[],
  amp: bigint,
) => bigint;

export type get_D_precisions = (
  self: IPoolContext,
  coin_balances: bigint[],
  amp: bigint,
) => bigint;

export type get_D = (self: IPoolContext, xp: bigint[], amp: bigint) => bigint;

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

/*
 * This is customized self context that is used for pricing. It gives us big flexibility
 * to include any available function implementation we want.
 * There is one problem. Not all classes ahs all functions and not all functions we need
 * That is solved by throwing function: notExist and notImplemented.
 * If something is not implemented or not exist we except to not call it ever.
 * If it happens by mistake we will know by raised exception and it means something is missed
 *
 * Here we have pool constants. They can not be requested from RPC, so it must be set from source code
 * Instead of having implementationAddress, I operated on Name level. Address level is put on config level
 * since different metaPool implementations have different addresses on different chains, but
 * pools may be duplicated and that is resembled in name.
 * But mostly custom pools are quite unique. Actually, not very unique, there are many implementations
 * that looks different, but essentially the same. I tried to not unite them into one implementations for simplicity
 */
export interface IPoolContext {
  readonly _basePool?: IPoolContext;

  readonly IMPLEMENTATION_NAME: ImplementationNames;

  readonly constants: PoolContextConstants;

  _calc_withdraw_one_coin: _calc_withdraw_one_coin;
  _dynamic_fee: _dynamic_fee;
  _rates: _rates;
  _xp_mem: _xp_mem;
  _xp: _xp;
  calc_token_amount: calc_token_amount;
  calc_withdraw_one_coin: calc_withdraw_one_coin;
  get_D_mem: get_D_mem;
  get_D_precision: get_D_precisions;
  get_D: get_D;
  get_dy_underlying: get_dy_underlying;
  get_dy: get_dy;
  get_y_D: get_y_D;
  get_y: get_y;
}
