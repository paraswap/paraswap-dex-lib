export const MIN_USD_LIQUIDITY_TO_FETCH = 100n;
export const MAX_POOL_CNT = 1000; // Taken from SOR
export const POOL_CACHE_TTL = 60 * 60; // 1 hr
// 271719 - 57856 - 79098 - 51041 = 83724 ~ 84k
export const STABLE_GAS_COST = 84_000;

// I see three pools used in trade: (57856 + 79098 + 51041) / 3 = 62665 ~ 63k
export const VARIABLE_GAS_COST_PER_CYCLE = 63_000;
