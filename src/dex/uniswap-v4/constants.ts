// This is used for price calculation. If out of scope, return 0n
import { Network } from '../../constants';

export const TICK_BITMAP_TO_USE = 4n;

// This is used to check if the state is still valid.
export const TICK_BITMAP_BUFFER = 8n;

export const TICK_BITMAP_TO_USE_BY_CHAIN: Record<number, bigint> = {
  [Network.MAINNET]: 8n,
};

export const TICK_BITMAP_BUFFER_BY_CHAIN: Record<number, bigint> = {
  [Network.MAINNET]: 16n,
};

export const OUT_OF_RANGE_ERROR_POSTFIX = `INVALID_TICK_BIT_MAP_RANGES`;

export const SUBGRAPH_TIMEOUT = 30 * 1000;

export const POOL_CACHE_REFRESH_INTERVAL = 60 * 5; // 5 minutes
