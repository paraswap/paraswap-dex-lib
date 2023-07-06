import { Address, NumberAsString } from '../../types';
import { Tick } from './lib/TickManager';

type Timepoint = {
  initialized: boolean;
  blockTimestamp: bigint;
  tickCumulative: bigint;
  secondsPerLiquidityCumulative: bigint;
  volatilityCumulative: bigint;
  averageTick: bigint;
  volumePerLiquidityCumulative: bigint;
};

type GlobalState = {
  price: bigint; // The square root of the current price in Q64.96 format
  tick: bigint; // The current tick
  fee: bigint; // The current fee in hundredths of a bip, i.e. 1e-6
  timepointIndex: bigint; // The index of the last written timepoint
  communityFeeToken0: bigint; // The community fee represented as a percent of all collected fee in thousandths (1e-3)
  communityFeeToken1: bigint;
  unlocked: boolean; // True if the contract is unlocked, otherwise - false
};

export type PoolState = {
  pool: Address;
  blockTimestamp: bigint;
  // no tickSpacing
  // no fee here ?
  globalState: GlobalState; // eq slot0
  liquidity: bigint;
  // no maxLiquidityPerTick
  tickTable: Record<NumberAsString, bigint>; // eq tickBitmap
  ticks: Record<NumberAsString, Tick>;
  timepoints: Record<number, Timepoint>; // timepoints is eq observations
  volumePerLiquidityInBlock: bigint; // oracle stuff skip does not participate in getSingleTimepoint https://github.com/cryptoalgebra/Algebra/blob/d4c1a57accf5e14d542c534c6c724a620565c176/src/core/contracts/AlgebraPool.sol#L299
  liquidityCooldown: bigint;
  activeIncentive: Address;
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
