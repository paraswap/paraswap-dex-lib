import BigNumber from 'bignumber.js';

/**
 * Cables
 */
export const CABLES_API_URL =
  'https://cables-evm-rfq-service.cryptosrvc.com/v1';

export const CABLES_PRICES_CACHES_TTL_S = 3;
export const CABLES_API_PRICES_POLLING_INTERVAL_MS = 1000; // 1 sec

export const CABLES_PAIRS_CACHES_TTL_S = 10 * 60; // 10 mins
export const CABLES_API_PAIRS_POLLING_INTERVAL_MS = 1000 * 60 * 10; // 10 mins

export const CABLES_BLACKLIST_CACHES_TTL_S = 30 * 60; // 30 mins
export const CABLES_API_BLACKLIST_POLLING_INTERVAL_MS = 1000 * 60 * 60; // 60 mins

export const CABLES_TOKENS_CACHES_TTL_S = 10 * 60; // 10 mins
export const CABLES_FIRM_QUOTE_TIMEOUT_MS = 2000;

export const CABLES_RATE_LIMITED_TTL_S = 60 * 60; // 1 hour
export const CABLES_RATELIMIT_CACHE_VALUE = 'limited';

export const CABLES_RESTRICT_TTL_S = 60 * 30; // 30 minutes
export const CABLES_RESTRICTED_CACHE_KEY = 'restricted';

export const CABLES_MIN_SLIPPAGE_FACTOR_THRESHOLD_FOR_RESTRICTION =
  new BigNumber('0.005');

export const CABLES_GAS_COST = 120_000;
