import { BigNumber } from 'ethers';
import { Address, NumberAsString } from '../../types';
import { TickInfo } from '../uniswap-v3/types';

type Timepoint = {
  initialized: boolean;
  blockTimestamp: bigint;
  tickCumulative: bigint;
  secondsPerLiquidityCumulative: bigint;
  // volatilityCumulative: bigint;
  // averageTick: bigint;
  // volumePerLiquidityCumulative: bigint;
};

type GlobalState = {
  price: bigint; // The square root of the current price in Q64.96 format
  tick: bigint; // The current tick
  fee: bigint; // The current fee in hundredths of a bip, i.e. 1e-6
  communityFeeToken0: bigint; // The community fee represented as a percent of all collected fee in thousandths (1e-3)
  communityFeeToken1: bigint;
  // unlocked: boolean; // True if the contract is unlocked, otherwise - false
};

export type PoolState = {
  pool: string;
  blockTimestamp: bigint;
  tickSpacing: bigint; // is actually constant
  globalState: GlobalState; // eq slot0
  liquidity: bigint;
  maxLiquidityPerTick: bigint; // is actually constant
  tickBitmap: Record<NumberAsString, bigint>; // actually called tickTable in contract-
  ticks: Record<NumberAsString, TickInfo>; // although variable names are different in contracts but matches UniswapV3 TickInfo struct 1:1
  isValid: boolean;
  startTickBitmap: bigint;
  balance0: bigint;
  balance1: bigint;
};

export type AlgebraData = {
  path: {
    tokenIn: Address;
    tokenOut: Address;
  }[];
  isApproved?: boolean;
};

export type DexParams = {
  router: Address;
  quoter: Address;
  factory: Address;
  algebraStateMulticall: Address;
  uniswapMulticall: Address;
  chunksCount: number;
  deployer: Address;
  subgraphURL: string;
  initHash: string;
};

export type TickBitMapMappingsWithBigNumber = {
  index: number;
  value: BigNumber;
};

export type TickInfoWithBigNumber = {
  initialized: boolean;
  liquidityGross: BigNumber;
  liquidityNet: BigNumber;
  secondsOutside: number;
  secondsPerLiquidityOutsideX128: BigNumber;
  tickCumulativeOutside: BigNumber;
};

export type TickInfoMappingsWithBigNumber = {
  index: number;
  value: TickInfoWithBigNumber;
};

export type DecodedStateMultiCallResultWithRelativeBitmaps = {
  pool: Address;
  blockTimestamp: BigNumber;
  globalState: {
    price: BigNumber;
    tick: number;
    fee: number;
    communityFeeToken1: number;
    communityFeeToken0: number;
    // unlocked: boolean;
  };
  liquidity: BigNumber;
  tickSpacing: number;
  maxLiquidityPerTick: BigNumber;
  timepoints: {
    initialized: boolean;
    blockTimestamp: number;
    tickCumulative: BigNumber;
    secondsPerLiquidityCumulative: BigNumber;
    // volatilityCumulative: BigNumber;
    // averageTick: number;
    // volumePerLiquidityCumulative: BigNumber;
  };
  tickBitmap: TickBitMapMappingsWithBigNumber[];
  ticks: TickInfoMappingsWithBigNumber[];
};
