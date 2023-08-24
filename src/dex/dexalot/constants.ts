import BigNumber from 'bignumber.js';

export const DEXALOT_RATE_LIMITED_TTL_S = 60 * 60; // 1 hour

export const DEXALOT_PRICES_CACHES_TTL_S = 200;

export const DEXALOT_PAIRS_CACHES_TTL_S = 200;

export const DEXALOT_TOKENS_CACHES_TTL_S = 200;

export const DEXALOT_API_PRICES_POLLING_INTERVAL_MS = 1000;

export const DEXALOT_API_PAIRS_POLLING_INTERVAL_MS = 1000 * 30; // 28 secs

export const DEXALOT_API_TOKENS_POLLING_INTERVAL_MS = 1000 * 30; // 28 secs

export const DEXALOT_API_BLACKLIST_POLLING_INTERVAL_MS = 1000 * 60 * 60; // 1 hour

export const DEXALOT_API_URL = 'https://api.dexalot.com';

export const DEXALOT_GAS_COST = 100_000;
