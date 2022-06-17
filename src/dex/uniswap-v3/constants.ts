export const UNISWAPV3_QUOTE_GASLIMIT = 200_000;

export const STATE_REQUEST_CHUNK_AMOUNT = 2n;

export const OBSERVATIONS_ARRAY_SIZE = 65535;

export const LOWER_TICK_REQUEST_LIMIT = -6000n;
export const UPPER_TICK_REQUEST_LIMIT = 6000n;

export const UNISWAPV3_SUBGRAPH_URL =
  'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3';

export const UNISWAPV3_EFFICIENCY_FACTOR = 5;

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
