import _ from 'lodash';
import { CONVERGENCE_ERROR_PREFIX } from '../../constants';
import { ImplementationNames } from '../../types';
import { get_D, IPoolContext } from '../types';
import { getCachedValueOrCallFunc, requireConstant } from './utils';

/*
 * This function get_D may be optimized further. We are doing many redundant
 * calculations. It can be calculated once per new state and once for each implementation.
 * Not for every request and amount
 */

const customPlain3CoinThree: get_D = (
  self: IPoolContext,
  xp: bigint[],
  amp: bigint,
): bigint => {
  const { BI_N_COINS } = self.constants;

  let S = 0n;
  for (const _x of xp) {
    S += _x;
  }
  if (S === 0n) {
    return 0n;
  }

  let Dprev = 0n;
  let D = S;
  const Ann = amp * BI_N_COINS;
  for (const _i of _.range(255)) {
    let D_P = D;
    for (const _x of xp) {
      // If division by 0, this will be borked: only withdrawal will work. And that is good
      D_P = (D_P * D) / (_x * BI_N_COINS);
    }
    Dprev = D;
    D =
      ((Ann * S + D_P * BI_N_COINS) * D) /
      ((Ann - 1n) * D + (BI_N_COINS + 1n) * D_P);
    // Equality with the precision of 1
    if (D > Dprev) {
      if (D - Dprev <= 1n) {
        break;
      }
    } else {
      if (Dprev - D <= 1n) {
        break;
      }
    }
  }
  return D;
};

const customPlain2CoinFrax: get_D = (
  self: IPoolContext,
  xp: bigint[],
  amp: bigint,
): bigint => {
  const { BI_N_COINS } = self.constants;
  const A_PRECISION = requireConstant(
    self,
    'A_PRECISION',
    'customPlain2CoinFrax',
  );

  let S = 0n;
  let Dprev = 0n;

  for (const _x of xp) {
    S += _x;
  }
  if (S === 0n) {
    return 0n;
  }

  let D = S;
  const Ann = amp * BI_N_COINS;
  for (const _i of _.range(255)) {
    let D_P = D;
    for (const _x of xp) {
      // If division by 0, this will be borked: only withdrawal will work. And that is good
      D_P = (D_P * D) / (_x * BI_N_COINS);
    }
    Dprev = D;
    D =
      (((Ann * S) / A_PRECISION + D_P * BI_N_COINS) * D) /
      (((Ann - A_PRECISION) * D) / A_PRECISION + (BI_N_COINS + 1n) * D_P);
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
    `${CONVERGENCE_ERROR_PREFIX}_${self.IMPLEMENTATION_NAME}: function customPlain2CoinFrax didn't converge`,
  );
};

const factoryPlain2Basic: get_D = (
  self: IPoolContext,
  xp: bigint[],
  amp: bigint,
): bigint => {
  const { BI_N_COINS } = self.constants;
  const A_PRECISION = requireConstant(
    self,
    'A_PRECISION',
    'factoryPlain2Basic',
  );

  let S = 0n;
  for (const _x of xp) {
    S += _x;
  }
  if (S === 0n) {
    return 0n;
  }

  let D = S;
  const Ann = amp * BI_N_COINS;
  for (const _i of _.range(255)) {
    let D_P = (((D * D) / xp[0]) * D) / xp[1] / BI_N_COINS ** 2n;
    let Dprev = D;
    D =
      (((Ann * S) / A_PRECISION + D_P * BI_N_COINS) * D) /
      (((Ann - A_PRECISION) * D) / A_PRECISION + (BI_N_COINS + 1n) * D_P);
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
    `${CONVERGENCE_ERROR_PREFIX}_${self.IMPLEMENTATION_NAME}: function factoryPlain2Basic didn't converge`,
  );
};

const customAvalanche3CoinLending: get_D = (
  self: IPoolContext,
  xp: bigint[],
  amp: bigint,
): bigint => {
  const { BI_N_COINS } = self.constants;
  const A_PRECISION = requireConstant(
    self,
    'A_PRECISION',
    'customAvalanche3CoinLending',
  );

  let S = 0n;
  for (const _x of xp) {
    S += _x;
  }
  if (S === 0n) {
    return 0n;
  }

  let Dprev = 0n;
  let D = S;
  const Ann = amp * BI_N_COINS;
  for (const _i of _.range(255)) {
    let D_P = D;
    for (const _x of xp) {
      // If division by 0, this will be borked: only withdrawal will work. And that is good
      D_P = (D_P * D) / (_x * BI_N_COINS + 1n);
    }
    Dprev = D;
    D =
      (((Ann * S) / A_PRECISION + D_P * BI_N_COINS) * D) /
      (((Ann - A_PRECISION) * D) / A_PRECISION + (BI_N_COINS + 1n) * D_P);
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
    `${CONVERGENCE_ERROR_PREFIX}_${self.IMPLEMENTATION_NAME}: function customAvalanche3CoinLending didn't converge`,
  );
};

const makeFuncCacheable = (func: get_D): get_D => {
  return (self: IPoolContext, xp: bigint[], amp: bigint) => {
    const cacheKey =
      `get_D-` +
      `A_PRECISION:${self.constants.A_PRECISION?.toString()}` +
      `xp:${xp.join(',')}-` +
      `amp:${amp}`;

    return getCachedValueOrCallFunc(
      cacheKey,
      func.bind(undefined, self, xp, amp),
    );
  };
};

const implementations: Record<ImplementationNames, get_D> = {
  [ImplementationNames.CUSTOM_PLAIN_2COIN_FRAX]:
    makeFuncCacheable(customPlain2CoinFrax),
  [ImplementationNames.CUSTOM_PLAIN_2COIN_RENBTC]: makeFuncCacheable(
    customPlain3CoinThree,
  ),
  [ImplementationNames.CUSTOM_PLAIN_2COIN_WBTC]:
    makeFuncCacheable(customPlain2CoinFrax),
  [ImplementationNames.CUSTOM_PLAIN_3COIN_SBTC]: makeFuncCacheable(
    customPlain3CoinThree,
  ),
  [ImplementationNames.CUSTOM_PLAIN_3COIN_THREE]: makeFuncCacheable(
    customPlain3CoinThree,
  ),

  [ImplementationNames.CUSTOM_ARBITRUM_2COIN_BTC]:
    makeFuncCacheable(factoryPlain2Basic),
  [ImplementationNames.CUSTOM_ARBITRUM_2COIN_USD]:
    makeFuncCacheable(factoryPlain2Basic),

  [ImplementationNames.CUSTOM_AVALANCHE_3COIN_LENDING]: makeFuncCacheable(
    customAvalanche3CoinLending,
  ),

  [ImplementationNames.CUSTOM_FANTOM_2COIN_BTC]:
    makeFuncCacheable(customPlain2CoinFrax),
  [ImplementationNames.CUSTOM_FANTOM_2COIN_USD]:
    makeFuncCacheable(customPlain2CoinFrax),
  [ImplementationNames.CUSTOM_FANTOM_3COIN_LENDING]: makeFuncCacheable(
    customAvalanche3CoinLending,
  ),

  [ImplementationNames.CUSTOM_OPTIMISM_3COIN_USD]:
    makeFuncCacheable(customPlain2CoinFrax),

  [ImplementationNames.CUSTOM_POLYGON_2COIN_LENDING]:
    customAvalanche3CoinLending,
  [ImplementationNames.CUSTOM_POLYGON_3COIN_LENDING]:
    customAvalanche3CoinLending,

  [ImplementationNames.FACTORY_V1_META_BTC]:
    makeFuncCacheable(customPlain2CoinFrax),
  [ImplementationNames.FACTORY_V1_META_USD]:
    makeFuncCacheable(customPlain2CoinFrax),

  [ImplementationNames.FACTORY_META_BTC]:
    makeFuncCacheable(customPlain2CoinFrax),
  [ImplementationNames.FACTORY_META_BTC_BALANCES]:
    makeFuncCacheable(customPlain2CoinFrax),

  [ImplementationNames.FACTORY_META_BTC_REN]:
    makeFuncCacheable(customPlain2CoinFrax),
  [ImplementationNames.FACTORY_META_BTC_BALANCES_REN]:
    makeFuncCacheable(customPlain2CoinFrax),

  [ImplementationNames.FACTORY_META_USD]:
    makeFuncCacheable(customPlain2CoinFrax),
  [ImplementationNames.FACTORY_META_USD_BALANCES]:
    makeFuncCacheable(customPlain2CoinFrax),

  [ImplementationNames.FACTORY_META_USD_FRAX_USDC]:
    makeFuncCacheable(customPlain2CoinFrax),
  [ImplementationNames.FACTORY_META_USD_BALANCES_FRAX_USDC]:
    makeFuncCacheable(customPlain2CoinFrax),

  [ImplementationNames.FACTORY_PLAIN_2_BALANCES]:
    makeFuncCacheable(factoryPlain2Basic),
  [ImplementationNames.FACTORY_PLAIN_2_BASIC]:
    makeFuncCacheable(factoryPlain2Basic),
  [ImplementationNames.FACTORY_PLAIN_2_ETH]:
    makeFuncCacheable(factoryPlain2Basic),
  [ImplementationNames.FACTORY_PLAIN_2_OPTIMIZED]:
    makeFuncCacheable(factoryPlain2Basic),

  [ImplementationNames.FACTORY_PLAIN_3_BALANCES]:
    makeFuncCacheable(customPlain2CoinFrax),
  [ImplementationNames.FACTORY_PLAIN_3_BASIC]:
    makeFuncCacheable(customPlain2CoinFrax),
  [ImplementationNames.FACTORY_PLAIN_3_ETH]:
    makeFuncCacheable(customPlain2CoinFrax),
  [ImplementationNames.FACTORY_PLAIN_3_OPTIMIZED]:
    makeFuncCacheable(customPlain2CoinFrax),

  [ImplementationNames.FACTORY_PLAIN_4_BALANCES]:
    makeFuncCacheable(customPlain2CoinFrax),
  [ImplementationNames.FACTORY_PLAIN_4_BASIC]:
    makeFuncCacheable(customPlain2CoinFrax),
  [ImplementationNames.FACTORY_PLAIN_4_ETH]:
    makeFuncCacheable(customPlain2CoinFrax),
  [ImplementationNames.FACTORY_PLAIN_4_OPTIMIZED]:
    makeFuncCacheable(customPlain2CoinFrax),

  [ImplementationNames.FACTORY_META_BTC_SBTC2]:
    makeFuncCacheable(customPlain2CoinFrax),
  [ImplementationNames.FACTORY_META_BTC_BALANCES_SBTC2]:
    makeFuncCacheable(customPlain2CoinFrax),
  [ImplementationNames.FACTORY_PLAIN_2_BASIC_EMA]:
    makeFuncCacheable(factoryPlain2Basic),
  [ImplementationNames.FACTORY_PLAIN_2_ETH_EMA]:
    makeFuncCacheable(factoryPlain2Basic),
  [ImplementationNames.FACTORY_PLAIN_2_ETH_EMA2]:
    makeFuncCacheable(factoryPlain2Basic),
};

export default implementations;
