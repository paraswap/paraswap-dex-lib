export const NEGATIVE_ONE = -1n;
export const ZERO = 0n;
export const ONE = 1n;

export const BI_MAX_UINT128 = 2n ** 128n - 1n;
export const MAX_TICK_DISTANCE = 480n;
export const MAX_TICK_TRAVEL = 10n;
export const FEE_UNITS = 100000n;
export const TWO_FEE_UNITS = FEE_UNITS + FEE_UNITS;
export const TWO_POW_96 = BigInt(2) ** BigInt(96);

export const KS_ELASTIC_QUOTE_GASLIMIT = 200_000;
export const KS_ELASTIC_EFFICIENCY_FACTOR = 5;
export const KS_ELASTIC_TICK_GAS_COST = 24_000; // Ceiled
export const KS_ELASTIC_TICK_BASE_OVERHEAD = 75_000;
export const KS_ELASTIC_POOL_SEARCH_OVERHEAD = 10_000;
