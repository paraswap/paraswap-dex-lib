import { Address } from '../../types';

export type FluidDexPoolState = {
  collateralReserves: CollateralReserves;
  debtReserves: DebtReserves;
  fee: number;
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
  token0: Address;
  token1: Address;
};

export type DexParams = {
  commonAddresses: CommonAddresses;
  pools: FluidDexPool[];
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
