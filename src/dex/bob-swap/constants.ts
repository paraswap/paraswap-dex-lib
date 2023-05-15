import { PoolState } from './types';

export const NULL_STATE: PoolState = {
  collaterals: {},
};

export const BOB_VAULT_GAS_COST = {
  buy: 110_000,
  sell: 270_000,
  swap: 290_000,
};

export const DENOMINATOR: bigint = 10n ** 18n;

export const MAX_FEE: bigint = 10n ** 16n;
