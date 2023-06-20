import BigNumber from 'bignumber.js';

export const HASHFLOW_BLACKLIST_TTL_S = 60 * 60 * 24 * 7; // 7 days

export const HASHFLOW_MM_RESTRICT_TTL_S = 60 * 60;

export const HASHFLOW_PRICES_CACHES_TTL_S = 3;

export const HASHFLOW_MARKET_MAKERS_CACHES_TTL_S = 30;

export const HASHFLOW_API_PRICES_POLLING_INTERVAL_MS = 1000;

export const HASHFLOW_API_MARKET_MAKERS_POLLING_INTERVAL_MS = 28 * 1000; // 28 secs

export const HASHFLOW_API_URL = 'https://api.hashflow.com';

export const HASHFLOW_API_CLIENT_NAME = 'paraswap';

export const HASHFLOW_GAS_COST = 100_000;

export const HASHFLOW_MIN_SLIPPAGE_FACTOR_THRESHOLD_FOR_RESTRICTION = new BigNumber('0.001');
