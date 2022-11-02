import { ImplementationNames, PoolState } from '../../types';
import { funcName } from '../../../../utils';
import { get_dy, IPoolContext } from '../types';
import { requireConstant } from './utils';

const factoryPlain2CoinErc20: get_dy = (
  self: IPoolContext,
  state: PoolState,
  i: number,
  j: number,
  dx: bigint,
): bigint => {
  const { PRECISION, FEE_DENOMINATOR } = self.constants;
  const { rate_multipliers } = state.constants;
  const rates = [...rate_multipliers];
  const xp = self._xp_mem(self, rates, state.balances);

  const x = xp[i] + (dx * rates[i]) / PRECISION;
  const y = self.get_y(self, state, i, j, x, xp);
  const dy = xp[j] - y - 1n;
  const _fee = (state.fee * dy) / FEE_DENOMINATOR;
  return ((dy - _fee) * PRECISION) / rates[j];
};

const factoryPlain2CoinErc20_18D: get_dy = (
  self: IPoolContext,
  state: PoolState,
  i: number,
  j: number,
  dx: bigint,
): bigint => {
  const { FEE_DENOMINATOR } = self.constants;
  const xp = [...state.balances];

  const x = xp[i] + dx;
  const y = self.get_y(self, state, i, j, x, xp);
  const dy = xp[j] - y - 1n;
  const fee = (state.fee * dy) / FEE_DENOMINATOR;
  return dy - fee;
};

const factoryMeta3Pool2_8: get_dy = (
  self: IPoolContext,
  state: PoolState,
  i: number,
  j: number,
  dx: bigint,
): bigint => {
  if (state.basePoolState?.virtualPrice === undefined) {
    throw new Error(
      `${self.IMPLEMENTATION_NAME} ${funcName}: basePoolState virtualPrice is undefined`,
    );
  }

  const { PRECISION, FEE_DENOMINATOR } = self.constants;
  const { rate_multipliers } = state.constants;
  const rates = [rate_multipliers[0], state.basePoolState?.virtualPrice];
  const xp = self._xp_mem(self, rates, state.balances);

  const x = xp[i] + (dx * rates[i]) / PRECISION;
  const y = self.get_y(self, state, i, j, x, xp);
  const dy = xp[j] - y - 1n;
  const _fee = (state.fee * dy) / FEE_DENOMINATOR;
  return ((dy - _fee) * PRECISION) / rates[j];
};

const customPlain3CoinThree: get_dy = (
  self: IPoolContext,
  state: PoolState,
  i: number,
  j: number,
  dx: bigint,
): bigint => {
  const { FEE_DENOMINATOR, PRECISION } = self.constants;
  const RATES = requireConstant(self, 'RATES', funcName());
  const rates = [...RATES];
  const xp = self._xp(self, state);

  const x = xp[i] + (dx * rates[i]) / PRECISION;
  const y = self.get_y(self, state, i, j, x, xp);
  const dy = ((xp[j] - y - 1n) * PRECISION) / rates[j];
  const _fee = (state.fee * dy) / FEE_DENOMINATOR;
  return dy - _fee;
};

const customPlain2CoinFrax: get_dy = (
  self: IPoolContext,
  state: PoolState,
  i: number,
  j: number,
  dx: bigint,
): bigint => {
  const { FEE_DENOMINATOR, PRECISION } = self.constants;
  const RATES = requireConstant(self, 'RATES', funcName());
  const rates = [...RATES];
  const xp = self._xp(self, state);

  const x = xp[i] + (dx * rates[i]) / PRECISION;
  const y = self.get_y(self, state, i, j, x, xp);
  const dy = xp[j] - y - 1n;
  const fee = (state.fee * dy) / FEE_DENOMINATOR;
  return ((dy - fee) * PRECISION) / rates[j];
};

const customPlain3CoinBtc: get_dy = (
  self: IPoolContext,
  state: PoolState,
  i: number,
  j: number,
  dx: bigint,
) => {
  const { PRECISION, FEE_DENOMINATOR } = self.constants;
  const rates = self._rates(self, state);
  const xp = self._xp(self, state);

  const x = xp[i] + (dx * rates[i]) / PRECISION;
  const y = self.get_y(self, state, i, j, x, xp);
  const dy = ((xp[j] - y - 1n) * PRECISION) / rates[j];
  const _fee = (state.fee * dy) / FEE_DENOMINATOR;
  return dy - _fee;
};

const implementations: Record<ImplementationNames, get_dy> = {
  [ImplementationNames.FACTORY_PLAIN_2COIN_ERC20]: factoryPlain2CoinErc20,
  [ImplementationNames.FACTORY_PLAIN_2COIN_ERC20_18DEC]:
    factoryPlain2CoinErc20_18D,
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
  [ImplementationNames.FACTORY_META_FRAX]: factoryMeta3Pool2_8,
  [ImplementationNames.FACTORY_META_3POOL_FEE_TRANSFER]: factoryMeta3Pool2_8,
  [ImplementationNames.FACTORY_META_BTC]: factoryMeta3Pool2_8,

  [ImplementationNames.CUSTOM_PLAIN_3COIN_THREE]: customPlain3CoinThree,
  [ImplementationNames.CUSTOM_PLAIN_2COIN_FRAX]: customPlain2CoinFrax,
  [ImplementationNames.CUSTOM_PLAIN_3COIN_BTC]: customPlain3CoinBtc,
};

export default implementations;
