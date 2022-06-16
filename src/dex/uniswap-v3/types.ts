import { NumberAsString } from '../../types';
import { Address } from '../../types';

export type OracleObservation = {
  blockTimestamp: bigint;
  tickCumulative: bigint;
  secondsPerLiquidityCumulativeX128: bigint;
  initialized: boolean;
};

export type OracleObservationCandidates = {
  beforeOrAt: OracleObservation;
  atOrAfter: OracleObservation;
};

export type TickInfo = {
  liquidityGross: bigint;
  liquidityNet: bigint;
  tickCumulativeOutside: bigint;
  secondsPerLiquidityOutsideX128: bigint;
  secondsOutside: bigint;
  initialized: boolean;
};

export type Slot0 = {
  sqrtPriceX96: bigint;
  tick: bigint;
  observationIndex: number;
  observationCardinality: number;
  observationCardinalityNext: number;
  feeProtocol: bigint;
};

export type PoolState = {
  blockTimestamp: bigint;
  tickSpacing: bigint;
  fee: bigint;
  slot0: Slot0;
  liquidity: bigint;
  maxLiquidityPerTick: bigint;
  tickBitmap: Record<NumberAsString, bigint>;
  ticks: Record<NumberAsString, TickInfo>;
  observations: OracleObservation[];
  isValid: boolean;
};

export type UniswapV3Data = {
  // ExactInputSingleParams
  fee: bigint;
};

export type DexParams = {
  router: Address;
  factory: Address;
  stateMulticall: Address;
  supportedFees: bigint[];
};

export type UniswapV3SellParam = {
  tokenIn: Address;
  tokenOut: Address;
  fee: bigint;
  recipient: Address;
  deadline: number;
  amountIn: NumberAsString;
  amountOutMinimum: NumberAsString;
  sqrtPriceLimitX96: NumberAsString;
};

export type UniswapV3BuyParam = {
  tokenIn: Address;
  tokenOut: Address;
  fee: bigint;
  recipient: Address;
  deadline: number;
  amountOut: NumberAsString;
  amountInMaximum: NumberAsString;
  sqrtPriceLimitX96: NumberAsString;
};

export type UniswapV3Param = UniswapV3SellParam | UniswapV3BuyParam;

export enum UniswapV3Functions {
  exactInputSingle = 'exactInputSingle',
  exactOutputSingle = 'exactOutputSingle',
}

export type TickInfoMappings = {
  index: number;
  value: TickInfo;
};

export type TickBitMapMappings = {
  index: number;
  value: bigint;
};
