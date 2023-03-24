import { PoolState } from './types';

export const WOO_FI_V2_GAS_COST = {
  // https://dashboard.tenderly.co/paraswap/paraswap/fork/f5a6da2f-fec7-4d00-ac2c-b9c50f5c9554/simulation/25f3b378-632f-4beb-ba37-e21dd3722b5c/gas-usage
  sellQuote: 145_000,
  // https://dashboard.tenderly.co/paraswap/paraswap/fork/92f13a98-465d-409e-867d-e255e9f86cf1/simulation/09d5d06a-dd90-40fe-8ae6-a65097e804d4/gas-usage
  sellBase: 159_000,
  // https://dashboard.tenderly.co/paraswap/paraswap/fork/d5964ad1-f64f-42b7-8fac-976ad216f05f/simulation/49df18de-8046-463e-a904-5c9f621406d4/gas-usage
  baseToBase: 204_000,
};

export const USD_PRECISION = 2;

export const MIN_CONVERSION_RATE = 1;

export const NULL_STATE: PoolState = {
  tokenInfos: {},
  tokenStates: {},
  decimals: {},
  oracleTimestamp: 0n,
  isPaused: false,
};
