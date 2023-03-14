import { PoolState } from './types';

// TODO: UPDATE GAS COST!
export const WOO_FI_V2_GAS_COST = 150 * 1000;

export const USD_PRECISION = 2;

export const MIN_CONVERSION_RATE = 1;

export const NULL_STATE: PoolState = {
  tokenInfos: {},
  tokenStates: {},
  decimals: {},
  oracleTimestamp: 0n,
  isPaused: false,
};
