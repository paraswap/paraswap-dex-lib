import { Address } from '../../types';

export type PoolState = {
  id: string;
  token0: Address;
  token1: Address;
  tickSpacing: number;
  tick: number;
};

export type UniswapV4Data = {
  exchange: Address;
  zeroForOne: boolean;
  pool: Pool;
};

export type Pool = {
  id: string;
  key: PoolKey;
};

export type DexParams = {
  poolManager: Address;
  quoter: Address;
  router: Address;
  subgraphURL: string;
  stateView: string;
};

export type PoolKey = {
  // The lower currency of the pool, sorted numerically
  currency0: Address;
  // The higher currency of the pool, sorted numerically
  currency1: Address;
  // The pool LP fee, capped at 1_000_000. If the highest bit is 1, the pool has a dynamic fee and must be exactly equal to 0x800000
  fee: string;
  // Ticks that involve positions must be a multiple of tick spacing
  tickSpacing: string;
  // The hooks of the pool
  hooks: Address;
};
