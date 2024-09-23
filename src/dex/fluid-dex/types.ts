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
  token0RealReserves: number; // Changed from uint to number
  token1RealReserves: number; // Changed from uint to number
  token0ImaginaryReserves: number; // Changed from uint to number
  token1ImaginaryReserves: number; // Changed from uint to number
};

export type DebtReserves = {
  token0Debt: number; // Changed from uint to number
  token1Debt: number; // Changed from uint to number
  token0RealReserves: number; // Changed from uint to number
  token1RealReserves: number; // Changed from uint to number
  token0ImaginaryReserves: number; // Changed from uint to number
  token1ImaginaryReserves: number; // Changed from uint to number
};

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
  token0: Address;
  token1: Address;
};

export type DexParams = {
  // TODO: DexParams is set of parameters the can
  // be used to initiate a DEX fork.
  // Complete me!
  pools: [FluidDexPool];
};
