import _ from 'lodash';
import { funcName } from '../../../../utils';
import { ImplementationNames, PoolState } from '../../types';
import { calc_token_amount, IPoolContext } from '../types';
import { throwNotImplemented } from './utils';

const customPlain3CoinThree: calc_token_amount = (
  self: IPoolContext,
  state: PoolState,
  amounts: bigint[],
  is_deposit: boolean,
) => {
  const { N_COINS } = self.constants;
  const amp = state.A;
  const balances = [...state.balances];
  const D0 = self.get_D_mem(self, state, balances, amp);
  for (const i of _.range(N_COINS)) {
    if (is_deposit) balances[i] += amounts[i];
    else balances[i] -= amounts[i];
  }
  const D1 = self.get_D_mem(self, state, balances, amp);

  if (state.totalSupply === undefined) {
    throw new Error(
      `${self.IMPLEMENTATION_NAME} ${funcName()}: totalSupply is not provided`,
    );
  }

  const token_amount = state.totalSupply;
  let diff = 0n;
  if (is_deposit) {
    diff = D1 - D0;
  } else {
    diff = D0 - D1;
  }
  return (diff * token_amount) / D0;
};

const notImplemented: calc_token_amount = (
  self: IPoolContext,
  state: PoolState,
  amounts: bigint[],
  is_deposit: boolean,
) => {
  return throwNotImplemented('calc_token_amount', self.IMPLEMENTATION_NAME);
};

const implementations: Record<ImplementationNames, calc_token_amount> = {
  [ImplementationNames.CUSTOM_PLAIN_2COIN_FRAX]: customPlain3CoinThree,
  [ImplementationNames.CUSTOM_PLAIN_2COIN_RENBTC]: customPlain3CoinThree,
  [ImplementationNames.CUSTOM_PLAIN_3COIN_SBTC]: customPlain3CoinThree,
  [ImplementationNames.CUSTOM_PLAIN_3COIN_THREE]: customPlain3CoinThree,

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
  [ImplementationNames.FACTORY_PLAIN_2_BASIC]: notImplemented,
  [ImplementationNames.FACTORY_PLAIN_2_ETH]: notImplemented,
  [ImplementationNames.FACTORY_PLAIN_2_OPTIMIZED]: notImplemented,

  [ImplementationNames.FACTORY_PLAIN_3_BALANCES]: notImplemented,
  [ImplementationNames.FACTORY_PLAIN_3_BASIC]: CHANGE,
  [ImplementationNames.FACTORY_PLAIN_3_ETH]: notImplemented,
  [ImplementationNames.FACTORY_PLAIN_3_OPTIMIZED]: notImplemented,

  [ImplementationNames.FACTORY_PLAIN_4_BALANCES]: notImplemented,
  [ImplementationNames.FACTORY_PLAIN_4_BASIC]: notImplemented,
  [ImplementationNames.FACTORY_PLAIN_4_ETH]: notImplemented,
  [ImplementationNames.FACTORY_PLAIN_4_OPTIMIZED]: notImplemented,
};

export default implementations;
