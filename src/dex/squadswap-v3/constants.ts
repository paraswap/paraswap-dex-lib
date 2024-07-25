export const SQUADSWAPV3_TICK_GAS_COST = 24_000; // Ceiled
export const SQUADSWAPV3_TICK_BASE_OVERHEAD = 75_000;
export const SQUADSWAPV3_POOL_SEARCH_OVERHEAD = 10_000;

// This is used for price calculation. If out of scope, return 0n
export const TICK_BITMAP_TO_USE = 4n;

// This is used to check if the state is still valid.
export const TICK_BITMAP_BUFFER = 8n;

export const MAX_PRICING_COMPUTATION_STEPS_ALLOWED = 128;

export const SQUADSWAPV3_SUBGRAPH_URL =
  'https://api.studio.thegraph.com/query/59394/test-pcs-uni/v0.0.8';

export const SQUADSWAPV3_EFFICIENCY_FACTOR = 3;

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

export const DEFAULT_POOL_INIT_CODE_HASH = `0xf08a35894b6b71b07d95a23022375630f6cee63a27d724c703617c17c4fc387d`;
