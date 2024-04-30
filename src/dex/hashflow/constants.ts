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

export const HASHFLOW_MIN_SLIPPAGE_FACTOR_THRESHOLD_FOR_RESTRICTION =
  new BigNumber('0.001');

export const RESTRICT_79_TTL_MS = 60 * 30 * 1000; // 30 mins
export const RESTRICT_SLIPPAGE_TTL_MS = 60 * 30 * 1000; // 30 mins
export const RESTRICT_84_TTL_MS = 60 * 10 * 1000; // 10 mins
export const RESTRICT_76_TTL_MS = 60 * 30 * 1000; // 30 mins
export const RESTRICT_82_TTL_MS = 60 * 30 * 1000; // 30 mins
export const RESTRICT_42_TTL_MS = 60 * 60 * 1000; // 60 mins
export const RESTRICT_85_TTL_MS = 60 * 20 * 1000; // 20 mins
export const RESTRICT_74_TTL_MS = 60 * 20 * 1000; // 20 mins
export const RESTRICT_UNKNOWN_TTL_MS = 60 * 60 * 1000; // 60 mins
export const RESTRICT_MISSING_QUOTE_DATA_TTL_MS = 60 * 10 * 1000; // 10 mins
export const RESTRICT_MISSING_SIGNATURE_TTL_MS = 60 * 10 * 1000; // 10 mins

export const UNKNOWN_ERROR_CODE = 'UNKNOWN';

export const ERROR_CODE_TO_RESTRICT_TTL = {
  '79': RESTRICT_79_TTL_MS, // {"code":79,"message":"Below minimum amount"}
  SLIPPAGE: RESTRICT_SLIPPAGE_TTL_MS, // Error: Hashflow-56: too much slippage on quote SELL quoteTokenAmount 800317519410129900 / destAmount 848781022570196154 < 0.995
  '84': RESTRICT_84_TTL_MS, // {"code":84,"message":"Rate Limit"}
  '76': RESTRICT_76_TTL_MS, // {"code":76,"message":"Exceeds supported amounts"}
  '82': RESTRICT_82_TTL_MS, // {"code":82,"message":"No maker supports this request"}
  '42': RESTRICT_42_TTL_MS, // {"code":42,"message":"Unknown error"}
  '85': RESTRICT_85_TTL_MS, // {"code":85,"message":"Markets too volatile"}
  '74': RESTRICT_74_TTL_MS, // {"code":74,"message":"No maker could quote"}
  MISSING_QUOTE_DATA: RESTRICT_MISSING_QUOTE_DATA_TTL_MS, //  missing quote data
  MISSING_SIGNATURE_DATA: RESTRICT_MISSING_SIGNATURE_TTL_MS, // missing signature
  [UNKNOWN_ERROR_CODE]: RESTRICT_UNKNOWN_TTL_MS, // unknown error
};

// not actually consecutive, meaning is if the error appeared > CONSECUTIVE_ERROR_THRESHOLD times within CONSECUTIVE_ERROR_TIMESPAN_MS ms -> restrict mm for ERROR_CODE_TO_RESTRICT_TTL[errorCode] ms
export const CONSECUTIVE_ERROR_TIMESPAN_MS = 60 * 60 * 1000; // 1 hour
export const CONSECUTIVE_ERROR_THRESHOLD = 3;
