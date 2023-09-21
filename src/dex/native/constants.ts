import BigNumber from 'bignumber.js';

export const NATIVE_RFQ_PRICES_CACHES_TTL_S = 3;

export const NATIVE_RFQ_API_PRICES_POLLING_INTERVAL_MS = 1000;

export const NATIVE_PRICES_CACHE_KEY = 'levels';

export const NATIVE_TOKENS_POLLING_INTERVAL_MS = 1000 * 60 * 60; // 1 hour

export const NATIVE_TOKENS_CACHES_TTL_S = 7200; // 2 hours

export const NATIVE_TOKENS_CACHE_KEY = 'tokens';

export const NATIVE_API_URL =
  // 'https://newapi.native.org/v1';
  'https://newapi.beyourowndex.com/v1';

export const NATIVE_PRICES_ENDPOINT = 'levels';

export const NATIVE_QUOTE_ENDPOINT = 'order';

export const NATIVE_BLACKLIST_TTL_S = 60 * 60 * 24; // 24 hours

export const GAS_COST_ESTIMATION = 250_000;

export const NATIVE_MIN_SLIPPAGE_FACTOR_THRESHOLD_FOR_RESTRICTION =
  new BigNumber('0.001');

export const chainMap = {
  1: 'ethereum',
  3: 'rospten',
  4: 'rinkbey',
  10: 'optimism',
  56: 'bsc',
  137: 'polygon',
  250: 'fantom',
  1101: 'zkevm',
  42161: 'arbitrum',
  43114: 'avalanche',
};

export const NATIVE_ORDER_TYPE_SELL = 1;

export const NATIVE_ORDER_TYPE_BUY = 2;

export const NATIVE_QUOTE_TIMEOUT_MS = 3000;
