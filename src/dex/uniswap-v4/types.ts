import { Address, NumberAsString } from '../../types';
import { TickInfo } from '../uniswap-v3/types';

export type PoolManagerState = {
  _pools: PoolState[];
};

export type TickInfo = {
  liquidityGross: bigint;
  liquidityNet: bigint;
  feeGrowthOutside0X128: bigint;
  feeGrowthOutside1X128: bigint;
};

type PositionState = {
  liquidity: bigint;
  feeGrowthInside0LastX128: bigint;
  feeGrowthInside1LastX128: bigint;
};

export type PoolState = {
  slot0: string;
  feeGrowthGlobal0X128: bigint;
  feeGrowthGlobal1X128: bigint;
  liquidity: bigint;
  ticks: Record<NumberAsString, TickInfo>;
  tickBitmap: Record<NumberAsString, bigint>;
  positions: Record<NumberAsString, PositionState>;
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
  stateView: Address;
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
