
export interface IConcentratedLiquidityPoolStruct {
    Tick: Tick;
    InsertTickParams: InsertTickParams;
    Position: Position;
    MintParams: MintParams;
    SwapCache: SwapCache;
    SwapCacheLocal: SwapCacheLocal;
    SwapExecuteCache: SwapExecuteCache;
    LimitOrderTickData: LimitOrderTickData;
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
    nextTickToCross: number;
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
    
interface LimitOrderTickData {
    token0Liquidity: number;
    token1Liquidity: number;
    token0Claimable: bigint;
    token1Claimable: bigint;
    token0ClaimableGrowth: bigint;
    token1ClaimableGrowth: bigint;
    isActive: boolean;
}
      
     
      
