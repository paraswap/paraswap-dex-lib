export const PANCAKESWAPV3_FUNCTION_CALL_GAS_COST = 21_000; // Ceiled
export const PANCAKESWAPV3_TICK_GAS_COST = 24_000; // Ceiled

// This is used for price calculation. If out of scope, return 0n
export const TICK_BITMAP_TO_USE = 4n;

// This is used to check if the state is still valid.
export const TICK_BITMAP_BUFFER = 8n;

export const MAX_PRICING_COMPUTATION_STEPS_ALLOWED = 128;

export const PANCAKESWAPV3_EFFICIENCY_FACTOR = 3;

export const ZERO_TICK_INFO = {
  liquidityGross: 0n,
  liquidityNet: 0n,
  tickCumulativeOutside: 0n,
  secondsPerLiquidityOutsideX128: 0n,
  secondsOutside: 0n,
  initialized: false,
};

export const ZERO_ORACLE_OBSERVATION = {
  blockTimestamp: 0n,
  tickCumulative: 0n,
  secondsPerLiquidityCumulativeX128: 0n,
  initialized: false,
};

export const OUT_OF_RANGE_ERROR_POSTFIX = `INVALID_TICK_BIT_MAP_RANGES`;

export const DEFAULT_POOL_INIT_CODE_HASH = `0x6ce8eb472fa82df5469c6ab6d485f17c3ad13c8cd7af59b3d4a8026c5ce0f7e2`;
