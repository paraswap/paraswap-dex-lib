import { Address } from '../../types';

export type PoolReserve = {
  pool: string;
  token0: string;
  token1: string;
  fee: number;
  centerPrice: number;
  collateralReserves: CollateralReserves;
  debtReserves: DebtReserves;
  dexLimits: DexLimits;
};

export type PoolReserveResponse = [
  string,
  string,
  string,
  bigint,
  bigint,
  bigint[],
  bigint[],
  DexLimitResponse,
];

export type DexLimits = {
  withdrawableToken0: TokenLimit;
  withdrawableToken1: TokenLimit;
  borrowableToken0: TokenLimit;
  borrowableToken1: TokenLimit;
};

export type DexLimitResponse = [
  TokenLimitResponse,
  TokenLimitResponse,
  TokenLimitResponse,
  TokenLimitResponse,
];

export type TokenLimit = {
  available: bigint;
  expandsTo: bigint;
  expandsDuration: bigint;
};

export type TokenLimitResponse = [bigint, bigint, bigint];

export type FluidDexLiquidityProxyState = {
  poolsReserves: readonly PoolReserve[];
};

export type CollateralReserves = {
  token0RealReserves: bigint;
  token1RealReserves: bigint;
  token0ImaginaryReserves: bigint;
  token1ImaginaryReserves: bigint;
};

export type DebtReserves = {
  token0Debt: bigint;
  token1Debt: bigint;
  token0RealReserves: bigint;
  token1RealReserves: bigint;
  token0ImaginaryReserves: bigint;
  token1ImaginaryReserves: bigint;
};

export interface PoolWithReserves {
  pool: string;
  token0: string;
  token1: string;
  fee: number;
  centerPrice: number;
  collateralReserves: CollateralReserves;
  debtReserves: DebtReserves;
}

export type FluidDexData = {
  poolId: string;
};

// Each pool has a contract address and token pairs.
export type FluidDexPool = {
  id: string;
  address: Address;
  token0: Address;
  token1: Address;
};

export type DexParams = {
  commonAddresses: CommonAddresses;
};

export type CommonAddresses = {
  liquidityProxy: Address;
  resolver: Address;
  dexFactory: Address;
};

export type Pool = {
  address: Address;
  token0: Address;
  token1: Address;
};
