import { Address } from '../../types';

export type FluidDexPoolState = {
  collateralReserves: CollateralReserves;
  debtReserves: DebtReserves;
  fee: number;
};

export type CollateralReserves = {
  token0RealReserves: bigint; // Changed from uint to bigint
  token1RealReserves: bigint; // Changed from uint to bigint
  token0ImaginaryReserves: bigint; // Changed from uint to bigint
  token1ImaginaryReserves: bigint; // Changed from uint to bigint
};

export type DebtReserves = {
  token0Debt: bigint; // Changed from uint to bigint
  token1Debt: bigint; // Changed from uint to bigint
  token0RealReserves: bigint; // Changed from uint to bigint
  token1RealReserves: bigint; // Changed from uint to bigint
  token0ImaginaryReserves: bigint; // Changed from uint to bigint
  token1ImaginaryReserves: bigint; // Changed from uint to bigint
};

export interface PoolWithReserves {
  pool: string;
  token0_: string;
  token1_: string;
  fee: number;
  collateralReserves: CollateralReserves;
  debtReserves: DebtReserves;
}

export type FluidDexData = {
  colReserves: CollateralReserves;
  debtReserves: DebtReserves;
  exchange: Address;
};

// Each pool has a contract address and token pairs.
export type FluidDexPool = {
  id: string;
  address: Address;
  liquidityProxy: Address;
  resolver: Address;
  token0: Address;
  token1: Address;
};

export type DexParams = {
  pools: [FluidDexPool];
};

export type Pool = {
  address: Address;
  token0: Address;
  token1: Address;
};
