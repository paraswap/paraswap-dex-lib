import { Address } from '../../types';

export type FluidDexPoolState = {
  // TODO: poolState is the state of event
  // subscriber. This should be the minimum
  // set of parameters required to compute
  // pool prices. Complete me!
  collateralReserves: CollateralReserves;
  debtReserves: DebtReserves;
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
  collateralReserves: CollateralReserves;
  debtReserves: DebtReserves;
}

export type FluidDexData = {
  // TODO: FluidDexData is the dex data that is
  // returned by the API that can be used for
  // tx building. The data structure should be minimal.
  // Complete me!
  colReserves: CollateralReserves;
  debtReserves: DebtReserves;
  exchange: Address;
};

// Each pool has a contract address and token pairs.
export type FluidDexPool = {
  id: string;
  address: Address;
  debtOperations: Address;
  colOperations: Address;
  perfectOperationsAndSwapOut: Address;
  liquidityUserModule: Address;
  resolver: Address;
  token0: Address;
  token1: Address;
};

export type DexParams = {
  // TODO: DexParams is set of parameters the can
  // be used to initiate a DEX fork.
  // Complete me!
  pools: [FluidDexPool];
};
