import { ImplementationNames, PoolState } from '../../types';
import { calc_withdraw_one_coin, IPoolContext } from '../types';
import { throwNotImplemented } from './utils';

const customPlain3CoinThree: calc_withdraw_one_coin = (
  self: IPoolContext,
  state: PoolState,
  _token_amount: bigint,
  i: number,
): bigint => {
  return self._calc_withdraw_one_coin(self, state, _token_amount, i)[0];
};

const notImplemented: calc_withdraw_one_coin = (
  self: IPoolContext,
  state: PoolState,
  _token_amount: bigint,
  i: number,
) => {
  return throwNotImplemented(
    'calc_withdraw_once_coin',
    self.IMPLEMENTATION_NAME,
  );
};

export const implementations: Record<
  ImplementationNames,
  calc_withdraw_one_coin
> = {
  [ImplementationNames.CUSTOM_PLAIN_2COIN_FRAX]: customPlain3CoinThree,
  [ImplementationNames.CUSTOM_PLAIN_2COIN_RENBTC]: customPlain3CoinThree,
  [ImplementationNames.CUSTOM_PLAIN_2COIN_WBTC]: customPlain3CoinThree,
  [ImplementationNames.CUSTOM_PLAIN_3COIN_SBTC]: customPlain3CoinThree,
  [ImplementationNames.CUSTOM_PLAIN_3COIN_THREE]: customPlain3CoinThree,

  [ImplementationNames.CUSTOM_ARBITRUM_2COIN_BTC]: customPlain3CoinThree,
  [ImplementationNames.CUSTOM_ARBITRUM_2COIN_USD]: customPlain3CoinThree,

  [ImplementationNames.CUSTOM_AVALANCHE_3COIN_LENDING]: customPlain3CoinThree,

  [ImplementationNames.CUSTOM_FANTOM_2COIN_BTC]: customPlain3CoinThree,
  [ImplementationNames.CUSTOM_FANTOM_2COIN_USD]: customPlain3CoinThree,
  [ImplementationNames.CUSTOM_FANTOM_3COIN_LENDING]: customPlain3CoinThree,

  [ImplementationNames.CUSTOM_OPTIMISM_3COIN_USD]: customPlain3CoinThree,

  [ImplementationNames.CUSTOM_POLYGON_2COIN_LENDING]: customPlain3CoinThree,
  [ImplementationNames.CUSTOM_POLYGON_3COIN_LENDING]: customPlain3CoinThree,

  [ImplementationNames.FACTORY_V1_META_BTC]: notImplemented,
  [ImplementationNames.FACTORY_V1_META_USD]: notImplemented,

  [ImplementationNames.FACTORY_META_BTC]: notImplemented,
  [ImplementationNames.FACTORY_META_BTC_BALANCES]: notImplemented,

  [ImplementationNames.FACTORY_META_BTC_REN]: notImplemented,
  [ImplementationNames.FACTORY_META_BTC_BALANCES_REN]: notImplemented,

  [ImplementationNames.FACTORY_META_USD]: notImplemented,
  [ImplementationNames.FACTORY_META_USD_BALANCES]: notImplemented,

  [ImplementationNames.FACTORY_META_USD_FRAX_USDC]: notImplemented,
  [ImplementationNames.FACTORY_META_USD_BALANCES_FRAX_USDC]: notImplemented,

  [ImplementationNames.FACTORY_PLAIN_2_BALANCES]: notImplemented,
  [ImplementationNames.FACTORY_PLAIN_2_BASIC]: customPlain3CoinThree,
  [ImplementationNames.FACTORY_PLAIN_2_ETH]: notImplemented,
  [ImplementationNames.FACTORY_PLAIN_2_OPTIMIZED]: notImplemented,

  [ImplementationNames.FACTORY_PLAIN_3_BALANCES]: notImplemented,
  [ImplementationNames.FACTORY_PLAIN_3_BASIC]: notImplemented,
  [ImplementationNames.FACTORY_PLAIN_3_ETH]: notImplemented,
  [ImplementationNames.FACTORY_PLAIN_3_OPTIMIZED]: notImplemented,

  [ImplementationNames.FACTORY_PLAIN_4_BALANCES]: notImplemented,
  [ImplementationNames.FACTORY_PLAIN_4_BASIC]: notImplemented,
  [ImplementationNames.FACTORY_PLAIN_4_ETH]: notImplemented,
  [ImplementationNames.FACTORY_PLAIN_4_OPTIMIZED]: notImplemented,
};

export default implementations;
