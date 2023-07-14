import { Address } from '../../types';
import { NumberAsString } from '../../types';

export type TickInfo = {
  liquidityGross: bigint;
  liquidityNet: bigint;
  feeGrowthOutside: bigint;
  secondsPerLiquidityOutside: bigint;
};

export type PoolData = {
  sqrtP: bigint;
  nearestCurrentTick: number;
  currentTick: number;
  baseL: bigint;
  reinvestL: bigint;
  reinvestLLast: bigint;
  feeGrowthGlobal: bigint;
  secondsPerLiquidityGlobal: bigint;
  secondsPerLiquidityUpdateTime: number;
};

export type ObservationData = {
  initialized: boolean;
  index: number;
  cardinality: number;
  cardinalityNext: number;
};

export type OracleObservation = {
  blockTimestamp: bigint;
  tickCumulative: bigint;
  initialized: boolean;
};

export type LinkedlistData = {
  previous: number;
  next: number;
};

export type PoolState = {
  pool: string;
  tickDistance: bigint;
  poolOracle?: ObservationData;
  poolObservation?: Record<number, OracleObservation>;
  maxTickLiquidity: bigint;
  swapFeeUnits: bigint;
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
  exactInput = 'exactInput',
  exactOutput = 'exactOutput',
}

export type PoolStateResponse = {
  sqrtP: bigint;
  currentTick: number;
  nearestCurrentTick: number;
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
  lastUpdateTime: number;
};

export type KyberElasticStateResponses =
  | PoolStateResponse
  | LiquidityStateResponse
  | FeeGrowthGlobalResponse
  | SecondsPerLiquidityResponse;
