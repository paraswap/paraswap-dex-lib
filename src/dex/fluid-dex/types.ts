import { Address } from '../../types';
import { BigNumber } from 'ethers';

export type PoolReserve = {
  pool: string;
  token0: string;
  token1: string;
  collateralReserves: CollateralReserves;
  debtReserves: DebtReserves;
  fee: number;
};

export type PoolReserveResponse = [
  string,
  string,
  string,
  BigNumber,
  BigNumber[],
  BigNumber[],
];

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
  collateralReserves: CollateralReserves;
  debtReserves: DebtReserves;
}

export type FluidDexData = {};

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
