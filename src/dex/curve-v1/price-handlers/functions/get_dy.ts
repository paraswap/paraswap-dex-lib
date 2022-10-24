import { get_y } from './get_y';
import { ImplementationNames, PoolState } from '../../types';
import { _A } from './_A';
import { get_D } from './get_D';
import { _xp_mem } from './_xp_mem';
import { funcName } from '../../../../utils';

interface DependantFuncs {
  _xp_mem: _xp_mem;
  get_y: get_y;
  _A: _A;
  get_D: get_D;
}

export type get_dy = (
  state: PoolState,
  funcs: DependantFuncs,
  i: number,
  j: number,
  dx: bigint,
  _balances: bigint[],
  basePoolVirtualPrice?: bigint,
) => bigint;

const factoryPlain2CoinErc20 = (
  state: PoolState,
  funcs: DependantFuncs,
  i: number,
  j: number,
  dx: bigint,
): bigint => {
  const { rate_multipliers, PRECISION, FEE_DENOMINATOR } = state.constants;
  const rates = rate_multipliers;
  const xp = funcs._xp_mem(state, rates, state.balances);

  const x = xp[i] + (dx * rates[i]) / PRECISION;
  const y = funcs.get_y(state, funcs, i, j, x, xp);
  const dy = xp[j] - y - 1n;
  const _fee = (state.fee * dy) / FEE_DENOMINATOR;
  return ((dy - _fee) * PRECISION) / rates[j];
};

const factoryPlain2CoinErc20_18D = (
  state: PoolState,
  funcs: DependantFuncs,
  i: number,
  j: number,
  dx: bigint,
): bigint => {
  const { FEE_DENOMINATOR } = state.constants;
  const xp = state.balances;

  const x = xp[i] + dx;
  const y = funcs.get_y(state, funcs, i, j, x, xp);
  const dy = xp[j] - y - 1n;
  const fee = (state.fee * dy) / FEE_DENOMINATOR;
  return dy - fee;
};

const factoryMeta3Pool2_8 = (
  state: PoolState,
  funcs: DependantFuncs,
  i: number,
  j: number,
  dx: bigint,
  basePoolVirtualPrice?: bigint,
): bigint => {
  if (basePoolVirtualPrice === undefined) {
    throw new Error(`${funcName}: basePoolVirtualPrice is undefined`);
  }

  const { rate_multiplier, PRECISION, FEE_DENOMINATOR } = state.constants;
  const rates = [rate_multiplier, basePoolVirtualPrice];
  const xp = { ...state.balances };

  if (state.balances[0] === 0n) {
    xp =
  }

  const x = xp[i] + (dx * rates[i]) / PRECISION;
  const y = funcs.get_y(state, funcs, i, j, x, xp);
  const dy = xp[j] - y - 1n;
  const _fee = (state.fee * dy) / FEE_DENOMINATOR;
  return ((dy - _fee) * PRECISION) / rates[j];
};

const implementations: Record<ImplementationNames, get_dy> = {
  [ImplementationNames.FACTORY_PLAIN_2COIN_ERC20]: factoryPlain2CoinErc20,
  [ImplementationNames.FACTORY_PLAIN_2COIN_ERC20_18DEC]:
    factoryPlain2CoinErc20_18D,
  // Difference only in internal balances name
  [ImplementationNames.FACTORY_PLAIN_2COIN_ERC20_FEE_TRANSFER]:
    factoryPlain2CoinErc20,
  [ImplementationNames.FACTORY_PLAIN_2COIN_NATIVE]: factoryPlain2CoinErc20,
  [ImplementationNames.FACTORY_PLAIN_3COIN_ERC20]: factoryPlain2CoinErc20,
  [ImplementationNames.FACTORY_PLAIN_3COIN_ERC20_18DEC]:
    factoryPlain2CoinErc20_18D,
  [ImplementationNames.FACTORY_PLAIN_3COIN_ERC20_FEE_TRANSFER]:
    factoryPlain2CoinErc20,
  [ImplementationNames.FACTORY_PLAIN_4COIN_ERC20]: factoryPlain2CoinErc20,
  [ImplementationNames.FACTORY_PLAIN_4COIN_ERC20_18DEC]:
    factoryPlain2CoinErc20_18D,
};

export default implementations;
