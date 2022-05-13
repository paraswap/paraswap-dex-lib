import { PoolState } from './types';

export const WOO_FI_GAS_COST = 270 * 1000;

export const USD_PRECISION = 2;

export const MIN_CONVERSION_RATE = 1;

export const NULL_STATE: PoolState = {
  feeRates: {},
  tokenInfos: {},
  tokenStates: {},
  oracleTimestamp: 0n,
  isPaused: false,
  guardian: {
    globalBound: 0n,
    refInfos: {},
  },
  chainlink: { latestRoundData: {} },
};
