import { BigNumber } from 'ethers';
import { NumberAsString } from '../../types';
import { Address } from '../../types';

export type TickInfo = {
    previousTick: bigint;
    nextTick: bigint;
    liquidity: bigint;
    feeGrowthOutside0: bigint; // Per unit of liquidity.
    feeGrowthOutside1: bigint;
    secondsGrowthOutside: bigint;
};


export type Slot0 = {
  sqrtPriceX96: bigint;
  tick: bigint;
};

export type PoolState = {
  pool: Address;
  //blockTimestamp: bigint;
  tickSpacing: bigint;
  slot0: Slot0;
  liquidity: bigint;
  ticks: Record<NumberAsString, TickInfo>;
  limitOrderTicks: Record<NumberAsString,LimitOrderTickData>
  isValid: boolean;
  balance0: bigint;
  balance1: bigint;
  swapFee:bigint;
  dfynFee: bigint;
  limitOrderFee:bigint;
  secondsGrowthGlobal:bigint;
  lastObservation:bigint;
  feeGrowthGlobal1:bigint;
  feeGrowthGlobal0:bigint;
  nearestPrice:bigint;
  limitOrderReserve0:bigint;
  limitOrderReserve1:bigint;
  token0LimitOrderFee:bigint;
  token1LimitOrderFee:bigint;
};


export interface StructHelper {
  Tick: Tick;
  InsertTickParams: InsertTickParams;
  Position: Position;
  MintParams: MintParams;
  SwapCache: SwapCache;
  SwapCacheLocal: SwapCacheLocal;
  SwapExecuteCache: SwapExecuteCache;
  LimitOrderTickData: LimitOrderTickData;
  ConcStruct: ConcStruct;
  CreateLimitOrderParams : CreateLimitOrderParams;
  ExecuteLimitOrderParams : ExecuteLimitOrderParams;
  LimitOrder : LimitOrder;
  TickCrossRequest : TickCrossRequest;
  TickCache : TickCache;
  FeeHandlerRequest : FeeHandlerRequest;
  ExecuteLimitResponse : ExecuteLimitResponse;
}

interface Tick {
  previousTick: number;
  nextTick: number;
  liquidity: bigint;
  feeGrowthOutside0: bigint; // Per unit of liquidity.
  feeGrowthOutside1: bigint;
  secondsGrowthOutside: number;
}
  
interface InsertTickParams {
  amount: bigint;
  nearestTick: number;
  currentPrice: number;
  tickCount: bigint;
  tickAtPrice: number;
}
  
interface Position {
  liquidity: bigint;
  feeGrowthInside0Last: bigint;
  feeGrowthInside1Last: bigint;
  }
  
interface MintParams {
  lowerOld: number;
  lower: number;
  upperOld: number;
  upper: number;
  amount0Desired: bigint;
  amount1Desired: bigint;
  native: boolean;
  }
  
interface SwapCache {
  exactIn: boolean;
  nextTickToCross: bigint;
  protocolFee: bigint;
  feeGrowthGlobalA: bigint;
  feeGrowthGlobalB: bigint;
  currentPrice: bigint;
  nearestPriceCached: bigint;
  currentLiquidity: bigint;
  limitOrderAmountOut: bigint;
  limitOrderAmountIn: bigint;
  limitOrderReserve: bigint;
  amountIn: bigint;
  amountOut: bigint;
  totalAmount: bigint;
  limitOrderFeeGrowth: bigint;
  token0LimitOrderFee: bigint;
  token1LimitOrderFee: bigint;
  tickCount: number;
  isFirstCycleState:boolean;
}
  
interface SwapCacheLocal {
  cross: boolean;
  nextTickPrice: bigint;
  fee: bigint;
  amountIn: bigint;
  amountOut: bigint;
  }
  
interface SwapExecuteCache {
  fee: bigint;
  amountIn: bigint;
  max: bigint;
  newPrice: bigint;
}
  
export interface LimitOrderTickData {
  token0Liquidity: bigint;
  token1Liquidity: bigint;
  token0Claimable: bigint;
  token1Claimable: bigint;
  token0ClaimableGrowth: bigint;
  token1ClaimableGrowth: bigint;
  isActive: boolean;
}

interface ConcStruct {
  currentPrice: bigint;
  amountIn: bigint;
  amountOut: bigint;
  exactIn: boolean;
  currentLiquidity: bigint;
};

interface CreateLimitOrderParams {
  tick: number;
  lowerOld: number;
  upperOld: number;
  zeroForOne: boolean;
  amountIn: bigint;
  price: bigint;
  nearestTick: number;
  tickCount: number;
};
interface ExecuteLimitOrderParams {
  tick:bigint;
  cross: boolean;
  exactIn: boolean;
  zeroForOne: boolean;
  sqrtpriceX96: bigint;
  amountIn: bigint;
  amountOut: bigint;
  limitOrderAmountOut: bigint;
  limitOrderAmountIn: bigint;
  limitOrderFee: bigint;
  token0LimitOrderFee: bigint;
  token1LimitOrderFee: bigint;
};

interface LimitOrderStatus {
  closed: number;
  active: number;
};

interface LimitOrder {
  pool: StructHelper;
  tick: number;
  status: LimitOrderStatus;
  zeroForOne: boolean;
  amountIn: bigint;
  amountOut: bigint;
  chargeAmount: bigint;
  rebateAmount: bigint;
  id: bigint;
  sqrtpriceX96: bigint;
  claimedAmount: bigint;
  claimableGrowth0: bigint;
  claimableGrowth1: bigint;
  // forwarder: string;
};      

interface TickCrossRequest{
  nextTickToCross: bigint;
  currentLiquidity: bigint;
}

interface TickCache {
  limitFee: bigint;
  limitOrderAmountIn: bigint;
  amountIn: bigint;
  amountInRemaining: bigint;
  limitOrderAmountOut: bigint;
  tokenLiquidity: bigint;
  tokenClaimable: bigint;
  tokenClaimableGrowth: bigint;
}
   
interface FeeHandlerRequest {
  feeAmount: bigint;
  dfynFee: bigint;
  currentLiquidity: bigint;
  protocolFee: bigint;
  feeGrowthGlobal: bigint;
}

interface ExecuteLimitResponse {
  amountIn: bigint;
  amountOut: bigint;
  cross: boolean;
  token0LimitOrderFee: bigint;
  token1LimitOrderFee: bigint;
  limitOrderAmountOut: bigint;
  limitOrderAmountIn: bigint;
}


export type DfynV2Data = {
  path: {
    tokenIn: Address;
    tokenOut: Address;
  }[];
};

export type DexParams = {
  router: Address;
  quoter: Address;
  factory: Address;
  poolHelper: Address;
  dfynMulticall: Address;
  supportedFees: bigint[];
  chunksCount: number;
};

export type DfynV2SellParam = {
  path: string;
  recipient: Address;
  deadline: number;
  amountIn: NumberAsString;
  amountOutMinimum: NumberAsString;
};

export type DfynV2BuyParam = {
  path: string;
  recipient: Address;
  deadline: number;
  amountOut: NumberAsString;
  amountInMaximum: NumberAsString;
};

export type DfynV2Param = DfynV2SellParam | DfynV2BuyParam;

export enum DfynV2Functions {
  exactInput = 'exactInput',
  exactOutput = 'exactOutput',
}



export type TickBitMapMappings = {
  index: number;
  value: bigint;
};

export type OutputResult = {
  outputs: bigint[];
  tickCounts: number[];
};

// Just rewrote every type with BigNumber basically

export type DecodedGetTickStateInfo = {
  index: BigNumber;
  liquidity: BigNumber;
}

export type DecodedGetTickState  = {
  ticks: DecodedGetTickStateInfo[]
}



/// Ticks

export type TickInfoWithBigNumber = {
  previousTick: BigNumber;
  nextTick: BigNumber;
  liquidity: BigNumber;
  feeGrowthOutside0: BigNumber; // Per unit of liquidity.
  feeGrowthOutside1: BigNumber;
  secondsGrowthOutside: BigNumber;
};

export type TickInfoMappingsWithBigNumber = {
  index: number;
  value: TickInfoWithBigNumber;
};

export type DecodedTicksData = {
  ticks : TickInfoMappingsWithBigNumber[]
}


/// Limit Order Ticks
export type LimitOrderTickInfoWithBigNumber = {
  token0Liquidity: BigNumber;
  token1Liquidity: BigNumber;
  token0Claimable: BigNumber;
  token1Claimable: BigNumber;
  token0ClaimableGrowth: BigNumber;
  token1ClaimableGrowth: BigNumber;
  isActive: boolean;
};

export type LimitOrderTickInfoMappingsWithBigNumber = {
  index: number;
  value: LimitOrderTickInfoWithBigNumber;
};

export type DecodedLimitOrderTicksData = {
  limitOrderTicks : LimitOrderTickInfoMappingsWithBigNumber[]
}

/// Reserves
export type DecodedGetReserves = {
  _reserve0 : BigNumber;
  _reserve1 : BigNumber;
}

/// Immutables
export type DecodedGetImmutables = {
    _MAX_TICK_LIQUIDITY: BigNumber;
    _tickSpacing: BigNumber;
    _swapFee: BigNumber;
    _dfynFeeTo: Address;
    _vault: Address;
    _masterDeployer:Address;
    _token0:Address;
    _token1: Address;
}


export type DecodedGetPriceAndNearestTicks = {
    _price :BigNumber;
    _nearestTick : BigNumber ;
}

export type DecodedGetSecondsGrowthAndLastObservation = {
  _secondsGrowthGlobal : BigNumber;
  _lastObservation : BigNumber;
}
