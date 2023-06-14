import { BI_POWS } from '../../../../bigint-constants';
import { ImplementationNames, PoolState } from '../../types';
import { get_dy_underlying, IPoolContext } from '../types';
import { throwNotExist, requireConstant } from './utils';

const factoryV1MetaUsd: get_dy_underlying = (
  self: IPoolContext,
  state: PoolState,
  i: number,
  j: number,
  dx: bigint,
): bigint => {
  if (state.basePoolState === undefined) {
    throw new Error(
      `${self.IMPLEMENTATION_NAME} factoryV1MetaUsd: received state with undefined basePoolState`,
    );
  }
  if (self._basePool === undefined) {
    throw new Error(
      `${self.IMPLEMENTATION_NAME} factoryV1MetaUsd: received self with undefined _basePool`,
    );
  }

  const { PRECISION, FEE_DENOMINATOR } = self.constants;
  const MAX_COIN = requireConstant(self, 'MAX_COIN', 'factoryV1MetaUsd');
  const BASE_N_COINS = requireConstant(
    self,
    'BASE_N_COINS',
    'factoryV1MetaUsd',
  );

  const { basePoolState, constants } = state;

  if (basePoolState.virtualPrice === undefined) {
    throw new Error(
      `${self.IMPLEMENTATION_NAME} factoryV1MetaUsd: basePoolState.virtualPrice is not defined`,
    );
  }

  const rates = [constants.rate_multipliers[0], basePoolState.virtualPrice];
  const xp = self._xp_mem(self, rates, state.balances);

  let x = 0n;
  let base_i = 0;
  let base_j = 0;
  let meta_i = 0;
  let meta_j = 0;

  if (i !== 0) {
    base_i = i - MAX_COIN;
    meta_i = 1;
  }
  if (j !== 0) {
    base_j = j - MAX_COIN;
    meta_j = 1;
  }

  if (i === 0) {
    x = xp[i] + dx * (rates[0] / BI_POWS[18]);
  } else {
    if (j == 0) {
      // i is from BasePool
      // At first, get the amount of pool tokens
      const base_inputs = new Array(BASE_N_COINS).fill(0n);
      base_inputs[base_i] = dx;
      // Token amount transformed to underlying "dollars"
      x =
        (self._basePool.calc_token_amount(
          self._basePool,
          basePoolState,
          base_inputs,
          true,
        ) *
          rates[1]) /
        PRECISION;
      // Accounting for deposit/withdraw fees approximately
      x -= (x * basePoolState.fee) / (2n * FEE_DENOMINATOR);
      // Adding number of pool tokens
      x += xp[MAX_COIN];
    } else {
      // If both are from the base pool
      return self._basePool.get_dy(
        self._basePool,
        basePoolState,
        base_i,
        base_j,
        dx,
      );
    }
  }

  // This pool is involved only when in-pool assets are used
  const y = self.get_y(self, state, meta_i, meta_j, x, xp);
  let dy = xp[meta_j] - y - 1n;
  dy = dy - (state.fee * dy) / FEE_DENOMINATOR;

  // If output is going via the metapool
  if (j == 0) {
    dy /= rates[0] / BI_POWS[18];
  } else {
    // j is from BasePool
    // The fee is already accounted for
    dy = self._basePool.calc_withdraw_one_coin(
      self._basePool,
      basePoolState,
      (dy * PRECISION) / rates[1],
      base_j,
    );
  }

  return dy;
};

const factoryMetaUsdFraxUsdc: get_dy_underlying = (
  self: IPoolContext,
  state: PoolState,
  i: number,
  j: number,
  dx: bigint,
): bigint => {
  if (state.basePoolState === undefined) {
    throw new Error(
      `${self.IMPLEMENTATION_NAME} factoryMetaUsdFraxUsdc: received state with undefined basePoolState`,
    );
  }
  if (self._basePool === undefined) {
    throw new Error(
      `${self.IMPLEMENTATION_NAME} factoryMetaUsdFraxUsdc: received self with undefined _basePool`,
    );
  }

  const { PRECISION, FEE_DENOMINATOR } = self.constants;
  const MAX_COIN = requireConstant(self, 'MAX_COIN', 'factoryMetaUsdFraxUsdc');
  const BASE_N_COINS = requireConstant(
    self,
    'BASE_N_COINS',
    'factoryMetaUsdFraxUsdc',
  );

  if (state.basePoolState.virtualPrice === undefined) {
    throw new Error(
      `${self.IMPLEMENTATION_NAME} factoryMetaUsdFraxUsdc: state.basePoolState.virtualPrice is not defined`,
    );
  }

  const { rate_multipliers } = state.constants;
  const rates = [rate_multipliers[0], state.basePoolState.virtualPrice];
  const xp = self._xp_mem(self, rates, state.balances);

  let x = 0n;
  let base_i = 0;
  let base_j = 0;
  let meta_i = 0;
  let meta_j = 0;

  if (i !== 0) {
    base_i = i - Number(MAX_COIN);
    meta_i = 1;
  }
  if (j !== 0) {
    base_j = j - Number(MAX_COIN);
    meta_j = 1;
  }

  if (i === 0) {
    x = xp[i] + dx * (rates[0] / BI_POWS[18]);
  } else {
    if (j == 0) {
      // i is from BasePool
      // At first, get the amount of pool tokens
      const base_inputs = new Array(BASE_N_COINS).fill(0n);
      base_inputs[base_i] = dx;
      // Token amount transformed to underlying "dollars"
      x =
        (self._basePool.calc_token_amount(
          self._basePool,
          state.basePoolState,
          base_inputs,
          true,
        ) *
          rates[1]) /
        PRECISION;
      // Accounting for deposit/withdraw fees approximately
      x -= (x * state.basePoolState.fee) / (2n * FEE_DENOMINATOR);
      // Adding number of pool tokens
      x += xp[Number(MAX_COIN)];
    } else {
      // If both are from the base pool
      return self._basePool.get_dy(
        self._basePool,
        state.basePoolState,
        base_i,
        base_j,
        dx,
      );
    }
  }

  // This pool is involved only when in-pool assets are used
  const y = self.get_y(self, state, meta_i, meta_j, x, xp);
  let dy = xp[meta_j] - y - 1n;
  dy = dy - (state.fee * dy) / FEE_DENOMINATOR;

  // If output is going via the metapool
  if (j == 0) {
    dy /= rates[0] / BI_POWS[18];
  } else {
    // j is from BasePool
    // The fee is already accounted for
    dy = self._basePool.calc_withdraw_one_coin(
      self._basePool,
      state.basePoolState,
      (dy * PRECISION) / rates[1],
      base_j,
    );
  }

  return dy;
};

const notExist: get_dy_underlying = (
  self: IPoolContext,
  state: PoolState,
  i: number,
  j: number,
  dx: bigint,
) => {
  return throwNotExist('get_dy_underlying', self.IMPLEMENTATION_NAME);
};

const implementations: Record<ImplementationNames, get_dy_underlying> = {
  [ImplementationNames.CUSTOM_PLAIN_2COIN_FRAX]: notExist,
  [ImplementationNames.CUSTOM_PLAIN_2COIN_RENBTC]: notExist,
  [ImplementationNames.CUSTOM_PLAIN_2COIN_WBTC]: notExist,
  [ImplementationNames.CUSTOM_PLAIN_3COIN_SBTC]: notExist,
  [ImplementationNames.CUSTOM_PLAIN_3COIN_THREE]: notExist,

  [ImplementationNames.CUSTOM_ARBITRUM_2COIN_BTC]: notExist,
  [ImplementationNames.CUSTOM_ARBITRUM_2COIN_USD]: notExist,

  [ImplementationNames.CUSTOM_AVALANCHE_3COIN_LENDING]: notExist,

  [ImplementationNames.CUSTOM_FANTOM_2COIN_BTC]: notExist,
  [ImplementationNames.CUSTOM_FANTOM_2COIN_USD]: notExist,
  [ImplementationNames.CUSTOM_FANTOM_3COIN_LENDING]: notExist,

  [ImplementationNames.CUSTOM_OPTIMISM_3COIN_USD]: notExist,

  [ImplementationNames.CUSTOM_POLYGON_2COIN_LENDING]: notExist,
  [ImplementationNames.CUSTOM_POLYGON_3COIN_LENDING]: notExist,

  [ImplementationNames.FACTORY_V1_META_BTC]: factoryV1MetaUsd,
  [ImplementationNames.FACTORY_V1_META_USD]: factoryV1MetaUsd,

  [ImplementationNames.FACTORY_META_BTC]: factoryMetaUsdFraxUsdc,
  [ImplementationNames.FACTORY_META_BTC_BALANCES]: factoryMetaUsdFraxUsdc,

  [ImplementationNames.FACTORY_META_BTC_REN]: factoryMetaUsdFraxUsdc,
  [ImplementationNames.FACTORY_META_BTC_BALANCES_REN]: factoryMetaUsdFraxUsdc,

  [ImplementationNames.FACTORY_META_USD]: factoryMetaUsdFraxUsdc,
  [ImplementationNames.FACTORY_META_USD_BALANCES]: factoryMetaUsdFraxUsdc,

  [ImplementationNames.FACTORY_META_USD_FRAX_USDC]: factoryMetaUsdFraxUsdc,
  [ImplementationNames.FACTORY_META_USD_BALANCES_FRAX_USDC]:
    factoryMetaUsdFraxUsdc,

  [ImplementationNames.FACTORY_PLAIN_2_BALANCES]: notExist,
  [ImplementationNames.FACTORY_PLAIN_2_BASIC]: notExist,
  [ImplementationNames.FACTORY_PLAIN_2_ETH]: notExist,
  [ImplementationNames.FACTORY_PLAIN_2_OPTIMIZED]: notExist,

  [ImplementationNames.FACTORY_PLAIN_3_BALANCES]: notExist,
  [ImplementationNames.FACTORY_PLAIN_3_BASIC]: notExist,
  [ImplementationNames.FACTORY_PLAIN_3_ETH]: notExist,
  [ImplementationNames.FACTORY_PLAIN_3_OPTIMIZED]: notExist,

  [ImplementationNames.FACTORY_PLAIN_4_BALANCES]: notExist,
  [ImplementationNames.FACTORY_PLAIN_4_BASIC]: notExist,
  [ImplementationNames.FACTORY_PLAIN_4_ETH]: notExist,
  [ImplementationNames.FACTORY_PLAIN_4_OPTIMIZED]: notExist,
};

export default implementations;
