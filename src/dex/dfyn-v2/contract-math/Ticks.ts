import { IConcentratedLiquidityPoolStruct } from "./IConcentratedLiquidityPool";
import { BI_POWS } from '../../../bigint-constants';
//import { ConcStruct, SwapExecuteCache } from "./ILimitOrderStruct";
import { DyDxMath } from "./DyDxMath";
import { FullMath } from "./FullMath";
import { UnsafeMath } from "./UnsafeMath";
import { number } from "joi";

interface TickCrossRequest{
    nextTickToCross: number;
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
  

export interface  ExecuteLimitOrderParams {
    tick: number;
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
}

export class Ticks{

    static cross(
        ticks: Record<number, IConcentratedLiquidityPoolStruct["Tick"]>,
        request: TickCrossRequest,
        secondsGrowthGlobal: number,
        feeGrowthGlobalA: number,
        feeGrowthGlobalB: number,
        zeroForOne: boolean,
        tickSpacing: number
    ): [number, number] {
        if (ticks[request.nextTickToCross].liquidity !== 0n) {
        ticks[request.nextTickToCross].secondsGrowthOutside = secondsGrowthGlobal - ticks[request.nextTickToCross].secondsGrowthOutside;
        if (zeroForOne) {
            // Moving backwards through the linked list.
            // Liquidity cannot overflow due to the MAX_TICK_LIQUIDITY requirement.
            if ((request.nextTickToCross / tickSpacing) % 2 === 0) {
            request.currentLiquidity -= ticks[request.nextTickToCross].liquidity;
            } else {
            request.currentLiquidity += ticks[request.nextTickToCross].liquidity;
            }
            ticks[request.nextTickToCross].feeGrowthOutside0 = BigInt(feeGrowthGlobalB) - ticks[request.nextTickToCross].feeGrowthOutside0;
            ticks[request.nextTickToCross].feeGrowthOutside1 = BigInt(feeGrowthGlobalA) - ticks[request.nextTickToCross].feeGrowthOutside1;
            request.nextTickToCross = ticks[request.nextTickToCross].previousTick;
        } else {
            // Moving forwards through the linked list.
            if ((request.nextTickToCross / tickSpacing) % 2 === 0) {
            request.currentLiquidity += ticks[request.nextTickToCross].liquidity;
            } else {
            request.currentLiquidity -= ticks[request.nextTickToCross].liquidity;
            }
            ticks[request.nextTickToCross].feeGrowthOutside1 = BigInt(feeGrowthGlobalB) - ticks[request.nextTickToCross].feeGrowthOutside1;
            ticks[request.nextTickToCross].feeGrowthOutside0 = BigInt(feeGrowthGlobalA) - ticks[request.nextTickToCross].feeGrowthOutside0;
            request.nextTickToCross = ticks[request.nextTickToCross].nextTick;
        }
        } else {
        if (zeroForOne) {
            request.nextTickToCross = ticks[request.nextTickToCross].previousTick;
        } else {
            request.nextTickToCross = ticks[request.nextTickToCross].nextTick;
        }
        }
    
        return [Number(request.currentLiquidity), request.nextTickToCross];
    }
    

    static excecuteLimitOrder(
        limitOrderTicks: Record<number, IConcentratedLiquidityPoolStruct["LimitOrderTickData"]>,
        params: ExecuteLimitOrderParams,
        limitOrderLiquidity: bigint
    ):[bigint, bigint, bigint, bigint, bigint, boolean] {

        const cache: TickCache = {
            limitFee : 0n,
            limitOrderAmountIn : 0n,
            amountIn :  0n,
            amountInRemaining : 0n,
            limitOrderAmountOut : 0n,
            tokenLiquidity : 0n,
            tokenClaimable : 0n,
            tokenClaimableGrowth : 0n,
        };
        

        if (!params.exactIn) {
            if (params.amountOut <= limitOrderLiquidity) {
            cache.limitOrderAmountIn = params.zeroForOne
                ? FullMath.mulDiv(FullMath.mulDiv(params.amountOut, BigInt(2**96), params.sqrtpriceX96), BigInt(2**96), params.sqrtpriceX96)
                : FullMath.mulDiv(FullMath.mulDiv(params.amountOut, params.sqrtpriceX96, BigInt(2**96)), params.sqrtpriceX96, BigInt(2**96));
            cache.tokenLiquidity = params.amountOut;
            params.limitOrderAmountOut += params.amountOut;
            params.amountOut = 0n;
            params.cross = false;
            } else {
            cache.limitOrderAmountIn = params.zeroForOne
                ? FullMath.mulDiv(FullMath.mulDiv(limitOrderLiquidity, BigInt(2**96), params.sqrtpriceX96), BigInt(2**96), params.sqrtpriceX96)
                : FullMath.mulDiv(FullMath.mulDiv(limitOrderLiquidity, params.sqrtpriceX96, BigInt(2**96)), params.sqrtpriceX96, BigInt(2**96));
            cache.tokenLiquidity = 0n;
            params.amountOut = params.amountOut - limitOrderLiquidity;
            params.limitOrderAmountOut += limitOrderLiquidity;
            }
            cache.tokenClaimable = cache.limitOrderAmountIn;
            cache.tokenClaimableGrowth = cache.limitOrderAmountIn;
        
            cache.limitFee = FullMath.mulDiv(cache.limitOrderAmountIn, params.limitOrderFee, BigInt(1e6) - params.limitOrderFee);
            params.limitOrderAmountIn += cache.limitOrderAmountIn;
            params.amountIn = cache.limitOrderAmountIn + cache.limitFee;
        } else {
            cache.amountIn = params.amountIn;
            cache.amountInRemaining = FullMath.mulDivRoundingUp(cache.amountIn, BigInt(1e6) - params.limitOrderFee, BigInt(1e6));
        
            cache.limitOrderAmountOut = params.zeroForOne
                ? FullMath.mulDiv(FullMath.mulDiv(cache.amountInRemaining, params.sqrtpriceX96, BigInt(2**96)), params.sqrtpriceX96, BigInt(2**96))
                : FullMath.mulDiv(FullMath.mulDiv(cache.amountInRemaining, BigInt(2**96), params.sqrtpriceX96), BigInt(2**96), params.sqrtpriceX96);
            if (limitOrderLiquidity >= cache.limitOrderAmountOut) {
                params.amountIn = cache.amountInRemaining;
                cache.tokenLiquidity = cache.limitOrderAmountOut;
                cache.tokenClaimable = cache.amountInRemaining;
                cache.tokenClaimableGrowth = cache.amountInRemaining;
        
                params.limitOrderAmountIn += params.amountIn;
                cache.limitFee = cache.amountIn - params.amountIn;
                params.amountIn = 0n;
                params.amountOut = cache.limitOrderAmountOut;
                params.cross = false;
                params.limitOrderAmountOut += params.amountOut;
            } else {
                cache.limitOrderAmountIn = params.zeroForOne
                    ? FullMath.mulDiv(FullMath.mulDiv(limitOrderLiquidity, BigInt(2**96), params.sqrtpriceX96), BigInt(2**96), params.sqrtpriceX96)
                    : FullMath.mulDiv(FullMath.mulDiv(limitOrderLiquidity, params.sqrtpriceX96, BigInt(2**96)), params.sqrtpriceX96, BigInt(2**96));
                params.amountIn -= cache.limitOrderAmountIn;
                cache.limitFee = FullMath.mulDiv(cache.limitOrderAmountIn, params.limitOrderFee, BigInt(1e6) - params.limitOrderFee);
                params.amountIn -= cache.limitFee;
                params.limitOrderAmountIn += cache.limitOrderAmountIn;
                cache.tokenLiquidity = 0n;
                cache.tokenClaimable = cache.limitOrderAmountIn;
                cache.tokenClaimableGrowth = cache.limitOrderAmountIn;
        
                params.limitOrderAmountOut += limitOrderLiquidity;
                params.amountOut = limitOrderLiquidity;
            }
        }
        if (params.zeroForOne) {
            limitOrderTicks[params.tick].token1Liquidity = cache.tokenLiquidity === 0n
                ? 0
                : limitOrderTicks[params.tick].token1Liquidity - Number(cache.tokenLiquidity);
            limitOrderTicks[params.tick].token0Claimable += cache.tokenClaimable;
            limitOrderTicks[params.tick].token0ClaimableGrowth += cache.tokenClaimableGrowth;
        } else {
            limitOrderTicks[params.tick].token0Liquidity = cache.tokenLiquidity === 0n
                ? 0
                : limitOrderTicks[params.tick].token0Liquidity - Number(cache.tokenLiquidity);
            limitOrderTicks[params.tick].token1Claimable += cache.tokenClaimable;
            limitOrderTicks[params.tick].token1ClaimableGrowth += cache.tokenClaimableGrowth;
        }
        return [cache.limitFee, params.amountIn, params.amountOut, params.limitOrderAmountOut, params.limitOrderAmountIn, params.cross];
        
    }
}