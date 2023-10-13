import { Address } from '../../types';
import { NumberAsString } from '../../types';

export type PoolPairsInfo = {
  token0: Address;
  token1: Address;
  swapFeeUnits: string;
};

export type PoolState = {
  pool: string;
  tickDistance: bigint;
  poolOracle?: ObservationData;
  poolObservation?: Record<NumberAsString, OracleObservation>;
  maxTickLiquidity: bigint;
  swapFeeUnits: bigint;
  governmentFeeTo: string;
  governmentFeeUnits: bigint;
  poolData: PoolData;
  ticks: Record<NumberAsString, TickInfo>;
  initializedTicks: Record<NumberAsString, LinkedlistData>;
  reinvestLiquidity: bigint;
  currentTick: bigint;
  balance0: bigint;
  balance1: bigint;
  isValid: boolean;
  blockTimestamp: bigint;
};

export type PoolData = {
  sqrtP: bigint;
  nearestCurrentTick: bigint;
  currentTick: bigint;
  baseL: bigint;
  reinvestL: bigint;
  reinvestLLast: bigint;
  feeGrowthGlobal: bigint;
  secondsPerLiquidityGlobal: bigint;
  secondsPerLiquidityUpdateTime: bigint;
  rTokenSupply: bigint;
  locked: boolean;
};

export type TickInfo = {
  liquidityGross: bigint;
  liquidityNet: bigint;
  feeGrowthOutside: bigint;
  secondsPerLiquidityOutside: bigint;
};

export type LinkedlistData = {
  previous: bigint;
  next: bigint;
};

export type ObservationData = {
  initialized: boolean;
  index: bigint;
  cardinality: bigint;
  cardinalityNext: bigint;
};

export type OracleObservation = {
  blockTimestamp: bigint;
  tickCumulative: bigint;
  initialized: boolean;
};

export type KyberswapElasticData = {
  path: {
    tokenIn: Address;
    tokenOut: Address;
    swapFeeUnits: NumberAsString;
  }[];
  isApproved?: boolean;
};

export type DexParams = {
  factory: Address;
  router: Address;
  positionManager: Address;
  quoter: Address;
  ticksFeesReader: Address;
  tokenPositionDescriptor: Address;
  supportedFees: bigint[];
  poolInitHash: string;
  chunksCount: number;
  subgraphURL?: string;
};

export type KyberElasticSellParam = {
  path: string;
  recipient: Address;
  deadline: string;
  amountIn: NumberAsString;
  amountOutMinimum: NumberAsString;
};

export type KyberElasticBuyParam = {
  path: string;
  recipient: Address;
  deadline: string;
  amountOut: NumberAsString;
  amountInMaximum: NumberAsString;
};

export type KyberElasticParam = KyberElasticSellParam | KyberElasticBuyParam;

export enum KyberElasticFunctions {
  quoteExactInputSingle = 'quoteExactInputSingle',
  quoteExactOutputSingle = 'quoteExactOutputSingle',
}

export type PoolStateResponse = {
  sqrtP: bigint;
  currentTick: bigint;
  nearestCurrentTick: bigint;
  locked: boolean;
};

export type LiquidityStateResponse = {
  baseL: bigint;
  reinvestL: bigint;
  reinvestLLast: bigint;
};

export type FeeGrowthGlobalResponse = bigint;

export type SecondsPerLiquidityResponse = {
  secondsPerLiquidityGlobal: bigint;
  lastUpdateTime: bigint;
};

export type FeeConfigurationResponse = {
  _feeTo: Address;
  _governmentFeeUnits: bigint;
};

export type InitializedTicksResponse = {
  previous: bigint;
  next: bigint;
};

export type TicksResponse = {
  liquidityGross: bigint;
  liquidityNet: bigint;
  feeGrowthOutside: bigint;
  secondsPerLiquidityOutside: bigint;
};

export type KyberElasticStateResponses =
  | bigint
  | PoolStateResponse
  | LiquidityStateResponse
  | FeeGrowthGlobalResponse
  | SecondsPerLiquidityResponse
  | FeeConfigurationResponse
  | InitializedTicksResponse
  | TicksResponse;

export type OutputResult = {
  outputs: bigint[];
  tickCounts: number[];
};
