import { get_y } from './get_y';
import { ImplementationNames, PoolState } from '../../types';
import { _A } from './_A';
import { get_D } from './get_D';
import { _xp_mem } from './_xp_mem';
import { funcName } from '../../../../utils';
import { _xp } from './_xp';
import { _get_y } from './_get_y';


const factoryPlain2CoinErc20: get_dy = (
  state: PoolState,
  funcs: DependantFuncs,
  i: number,
  j: number,
  dx: bigint,
): bigint => {
  const { rate_multipliers, PRECISION, FEE_DENOMINATOR } = state.constants;
  const rates = [...rate_multipliers];
  const xp = funcs._xp_mem(state, rates, state.balances);

  const x = xp[i] + (dx * rates[i]) / PRECISION;
  const y = funcs.get_y(state, funcs, i, j, x, xp);
  const dy = xp[j] - y - 1n;
  const _fee = (state.fee * dy) / FEE_DENOMINATOR;
  return ((dy - _fee) * PRECISION) / rates[j];
};

const factoryPlain2CoinErc20_18D: get_dy = (
  state: PoolState,
  funcs: DependantFuncs,
  i: number,
  j: number,
  dx: bigint,
): bigint => {
  const { FEE_DENOMINATOR } = state.constants;
  const xp = [...state.balances];

  const x = xp[i] + dx;
  const y = funcs.get_y(state, funcs, i, j, x, xp);
  const dy = xp[j] - y - 1n;
  const fee = (state.fee * dy) / FEE_DENOMINATOR;
  return dy - fee;
};

const factoryMeta3Pool2_8: get_dy = (
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
  const xp = funcs._xp_mem(state, rates, state.balances);

  const x = xp[i] + (dx * rates[i]) / PRECISION;
  const y = funcs.get_y(state, funcs, i, j, x, xp);
  const dy = xp[j] - y - 1n;
  const _fee = (state.fee * dy) / FEE_DENOMINATOR;
  return ((dy - _fee) * PRECISION) / rates[j];
};

const baseThreePool: get_dy = (
  state: PoolState,
  funcs: DependantFuncs,
  i: number,
  j: number,
  dx: bigint,
): bigint => {
  const { FEE_DENOMINATOR, RATES, PRECISION } = state.constants;
  const rates = [...RATES];
  const xp = funcs._xp(state);

  const x = xp[i] + (dx * rates[i]) / PRECISION;
  const y = funcs.get_y(state, funcs, i, j, x, xp);
  const dy = ((xp[j] - y - 1n) * PRECISION) / rates[j];
  const _fee = (state.fee * dy) / FEE_DENOMINATOR;
  return dy - _fee;
};

const baseFraxPool: get_dy = (
  state: PoolState,
  funcs: DependantFuncs,
  i: number,
  j: number,
  _dx: bigint,
): bigint => {
  const { FEE_DENOMINATOR, RATES, PRECISION } = state.constants;
  const rates = [...RATES];
  const xp = funcs._xp(state);

  const x = xp[i] + (_dx * rates[i]) / PRECISION;
  const y = funcs._get_y(state, funcs, i, j, x, xp);
  const dy = xp[j] - y - 1n;
  const fee = (state.fee * dy) / FEE_DENOMINATOR;
  return ((dy - fee) * PRECISION) / rates[j];
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

  [ImplementationNames.FACTORY_META_3POOL_2_8]: factoryMeta3Pool2_8,
  [ImplementationNames.FACTORY_META_3POOL_2_15]: factoryMeta3Pool2_8,
  [ImplementationNames.FACTORY_META_3POOL_3_1]: factoryMeta3Pool2_8,
  [ImplementationNames.FACTORY_META_3POOL_ERC20_FEE_TRANSFER]:
    factoryMeta3Pool2_8,
  [ImplementationNames.FACTORY_META_SBTC_ERC20]: factoryMeta3Pool2_8,

  [ImplementationNames.BASE_THREE_POOL]: baseThreePool,
  [ImplementationNames.BASE_FRAX_POOL]: baseFraxPool,
  [ImplementationNames.BASE_BTC_POOL]: ,
};

export default implementations;
