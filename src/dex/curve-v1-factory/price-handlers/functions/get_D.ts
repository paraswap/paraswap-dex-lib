import _ from 'lodash';
import { funcName } from '../../../../utils';
import { ImplementationNames, PoolState } from '../../types';
import { get_D, IPoolContext } from '../types';
import { requireConstant } from './utils';

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
  const A_PRECISION = requireConstant(self, 'A_PRECISION', funcName());

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
    `${self.IMPLEMENTATION_NAME}: function ${funcName()} didn't converge`,
  );
};

const factoryPlain2Basic: get_D = (
  self: IPoolContext,
  xp: bigint[],
  amp: bigint,
): bigint => {
  const { BI_N_COINS } = self.constants;
  const A_PRECISION = requireConstant(self, 'A_PRECISION', funcName());

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
    `${self.IMPLEMENTATION_NAME}: function ${funcName()} didn't converge`,
  );
};

const implementations: Record<ImplementationNames, get_D> = {
  [ImplementationNames.CUSTOM_PLAIN_2COIN_FRAX]: customPlain2CoinFrax,
  [ImplementationNames.CUSTOM_PLAIN_2COIN_RENBTC]: customPlain3CoinThree,
  [ImplementationNames.CUSTOM_PLAIN_3COIN_SBTC]: customPlain3CoinThree,
  [ImplementationNames.CUSTOM_PLAIN_3COIN_THREE]: customPlain3CoinThree,

  [ImplementationNames.FACTORY_V1_META_BTC]: customPlain2CoinFrax,
  [ImplementationNames.FACTORY_V1_META_USD]: customPlain2CoinFrax,

  [ImplementationNames.FACTORY_META_BTC]: customPlain2CoinFrax,
  [ImplementationNames.FACTORY_META_BTC_BALANCES]: customPlain2CoinFrax,

  [ImplementationNames.FACTORY_META_BTC_REN]: customPlain2CoinFrax,
  [ImplementationNames.FACTORY_META_BTC_BALANCES_REN]: customPlain2CoinFrax,

  [ImplementationNames.FACTORY_META_USD]: customPlain2CoinFrax,
  [ImplementationNames.FACTORY_META_USD_BALANCES]: customPlain2CoinFrax,

  [ImplementationNames.FACTORY_META_USD_FRAX_USDC]: customPlain2CoinFrax,
  [ImplementationNames.FACTORY_META_USD_BALANCES_FRAX_USDC]:
    customPlain2CoinFrax,

  [ImplementationNames.FACTORY_PLAIN_2_BALANCES]: factoryPlain2Basic,
  [ImplementationNames.FACTORY_PLAIN_2_BASIC]: factoryPlain2Basic,
  [ImplementationNames.FACTORY_PLAIN_2_ETH]: factoryPlain2Basic,
  [ImplementationNames.FACTORY_PLAIN_2_OPTIMIZED]: factoryPlain2Basic,

  [ImplementationNames.FACTORY_PLAIN_3_BALANCES]: customPlain2CoinFrax,
  [ImplementationNames.FACTORY_PLAIN_3_BASIC]: customPlain2CoinFrax,
  [ImplementationNames.FACTORY_PLAIN_3_ETH]: customPlain2CoinFrax,
  [ImplementationNames.FACTORY_PLAIN_3_OPTIMIZED]: customPlain2CoinFrax,

  [ImplementationNames.FACTORY_PLAIN_4_BALANCES]: customPlain2CoinFrax,
  [ImplementationNames.FACTORY_PLAIN_4_BASIC]: customPlain2CoinFrax,
  [ImplementationNames.FACTORY_PLAIN_4_ETH]: customPlain2CoinFrax,
  [ImplementationNames.FACTORY_PLAIN_4_OPTIMIZED]: customPlain2CoinFrax,
};

export default implementations;
