import { _require } from "../../../utils";
import { StructHelper , PoolState } from "./../types";
import { FullMath } from "./FullMath";
import { TickMath } from "./TickMath";

export class Ticks{

    static cross(
        ticks: PoolState["ticks"],
        request: StructHelper["TickCrossRequest"],
        secondsGrowthGlobal: bigint,
        feeGrowthGlobalA: bigint,
        feeGrowthGlobalB: bigint,
        zeroForOne: boolean,
        tickSpacing: bigint
    ): [bigint, bigint] {
            
        let nextTickToCross = Number(request.nextTickToCross)

        if (ticks[nextTickToCross].liquidity !== 0n) {
        ticks[nextTickToCross].secondsGrowthOutside = secondsGrowthGlobal - ticks[nextTickToCross].secondsGrowthOutside;
        if (zeroForOne) {
            // Moving backwards through the linked list.
            // Liquidity cannot overflow due to the MAX_TICK_LIQUIDITY requirement.
            if ((nextTickToCross / Number(tickSpacing)) % 2 === 0) {
            request.currentLiquidity -= ticks[nextTickToCross].liquidity;
            } else {
            request.currentLiquidity += ticks[nextTickToCross].liquidity;
            }
            ticks[nextTickToCross].feeGrowthOutside0 = BigInt(feeGrowthGlobalB) - ticks[nextTickToCross].feeGrowthOutside0;
            ticks[nextTickToCross].feeGrowthOutside1 = BigInt(feeGrowthGlobalA) - ticks[nextTickToCross].feeGrowthOutside1;
            nextTickToCross = Number(ticks[nextTickToCross].previousTick);
        } else {
            // Moving forwards through the linked list.
            if ((nextTickToCross /  Number(tickSpacing)) % 2 === 0) {
            request.currentLiquidity += ticks[nextTickToCross].liquidity;
            } else {
            request.currentLiquidity -= ticks[nextTickToCross].liquidity;
            }
            ticks[nextTickToCross].feeGrowthOutside1 = BigInt(feeGrowthGlobalB) - ticks[nextTickToCross].feeGrowthOutside1;
            ticks[nextTickToCross].feeGrowthOutside0 = BigInt(feeGrowthGlobalA) - ticks[nextTickToCross].feeGrowthOutside0;
            nextTickToCross = Number(ticks[nextTickToCross].nextTick);
        }
        } else {
        if (zeroForOne) {
            nextTickToCross = Number(ticks[nextTickToCross].previousTick);
        } else {
            nextTickToCross = Number(ticks[nextTickToCross].nextTick);
        }
        }
        
        const currentLiquidity = request.currentLiquidity
        const _nextTickToCross = BigInt(nextTickToCross)
        return [currentLiquidity,_nextTickToCross];
    }
    

    static excecuteLimitOrder(
        limitOrderTicks: PoolState["limitOrderTicks"],
        params: StructHelper["ExecuteLimitOrderParams"],
        limitOrderLiquidity: bigint
    ):[bigint, bigint, bigint, bigint, bigint, boolean] {

        const cache: StructHelper["TickCache"] = {
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
            limitOrderTicks[Number(params.tick)].token1Liquidity = cache.tokenLiquidity === 0n
                ? 0n
                : limitOrderTicks[Number(params.tick)].token1Liquidity - (cache.tokenLiquidity);
            limitOrderTicks[Number(params.tick)].token0Claimable += cache.tokenClaimable;
            limitOrderTicks[Number(params.tick)].token0ClaimableGrowth += cache.tokenClaimableGrowth;
        } else {
            limitOrderTicks[Number(params.tick)].token0Liquidity = cache.tokenLiquidity === 0n
                ? 0n
                : limitOrderTicks[Number(params.tick)].token0Liquidity - (cache.tokenLiquidity);
            limitOrderTicks[Number(params.tick)].token1Claimable += cache.tokenClaimable;
            limitOrderTicks[Number(params.tick)].token1ClaimableGrowth += cache.tokenClaimableGrowth;
        }
        return [cache.limitFee, params.amountIn, params.amountOut, params.limitOrderAmountOut, params.limitOrderAmountIn, params.cross];
        
    }

    static insert(
        ticks: PoolState["ticks"],
        limitOrderTicks: PoolState["limitOrderTicks"],
        feeGrowthGlobal0: bigint,
        feeGrowthGlobal1: bigint,
        secondsGrowthGlobal: bigint,
        lowerOld: bigint,
        lower: bigint,
        upperOld: bigint,
        upper: bigint,
        data: StructHelper["InsertTickParams"]
      ): [bigint, bigint] {
        _require(lower < upper, "WRONG_ORDER");
        _require(TickMath.MIN_TICK <= lower, "LOWER_RANGE");
        _require(upper <= TickMath.MAX_TICK, "UPPER_RANGE");
      
        {
          const currentLowerLiquidity: bigint = ticks[Number(lower)].liquidity;
          if (
            currentLowerLiquidity > 0n ||
            lower === TickMath.MIN_TICK ||
            limitOrderTicks[Number(lower)].isActive
          ) {
            // We are adding liquidity to an existing tick.
            ticks[Number(lower)].liquidity = currentLowerLiquidity + data.amount;
            if (currentLowerLiquidity == 0n) {
              if (lower <= data.tickAtPrice) {
                ticks[Number(lower)].feeGrowthOutside0 = feeGrowthGlobal0;
                ticks[Number(lower)].feeGrowthOutside1 = feeGrowthGlobal1;
                ticks[Number(lower)].secondsGrowthOutside = secondsGrowthGlobal;
              }
            }
          } else {
            // We are inserting a new tick.
            const old = ticks[Number(lowerOld)];
            const oldNextTick =  old.nextTick;
      
            _require(
              (old.liquidity > 0n || lowerOld === TickMath.MIN_TICK || limitOrderTicks[Number(lowerOld)].isActive) &&
                lowerOld < lower && lower < oldNextTick, "LOWER_ORDER"
            );
      
            if (lower <= data.tickAtPrice) {
              ticks[Number(lower)] = {
                previousTick: lowerOld,
                nextTick: oldNextTick,
                liquidity: data.amount,
                feeGrowthOutside0: feeGrowthGlobal0,
                feeGrowthOutside1: feeGrowthGlobal1,
                secondsGrowthOutside: secondsGrowthGlobal,
              };
            } else {
              ticks[Number(lower)] = {
                previousTick: lowerOld,
                nextTick: oldNextTick,
                liquidity: data.amount,
                feeGrowthOutside0: 0n,
                feeGrowthOutside1: 0n,
                secondsGrowthOutside: 0n,
              };
            }
      
            old.nextTick = lower;
            ticks[Number(oldNextTick)].previousTick = lower;
            data.tickCount++;
          }
        }
      
        const currentUpperLiquidity = ticks[Number(upper)].liquidity;
        if (
          currentUpperLiquidity > 0n ||
          upper === TickMath.MAX_TICK ||
          limitOrderTicks[Number(upper)].isActive
        ) {
          // We are adding liquidity to an existing tick.
          ticks[Number(upper)].liquidity = currentUpperLiquidity + data.amount;
          if (currentUpperLiquidity == 0n && upper !== TickMath.MAX_TICK) {
            if (upper <= data.tickAtPrice) {
              ticks[Number(upper)].feeGrowthOutside0 = feeGrowthGlobal0;
              ticks[Number(upper)].feeGrowthOutside1 = feeGrowthGlobal1;
              ticks[Number(upper)].secondsGrowthOutside = secondsGrowthGlobal;
            }
          }
        } else {
            // Inserting a new tick.
            const old  = ticks[Number(upperOld)];
            const oldNextTick = old.nextTick;
        
            _require(
                (old.liquidity > 0n ||
                    limitOrderTicks[Number(upperOld)].isActive ||
                    upperOld === TickMath.MAX_TICK) &&
                    oldNextTick > upper &&
                    upperOld < upper,
                "UPPER_ORDER"
            );
        
            if (upper <= data.tickAtPrice) {
                ticks[Number(upper)] = {
                    previousTick: upperOld,
                    nextTick: oldNextTick,
                    liquidity: data.amount,
                    feeGrowthOutside0: feeGrowthGlobal0,
                    feeGrowthOutside1: feeGrowthGlobal1,
                    secondsGrowthOutside: secondsGrowthGlobal,
                };
            } else {
                ticks[Number(upper)] = {
                    previousTick: upperOld,
                    nextTick: oldNextTick,
                    liquidity: data.amount,
                    feeGrowthOutside0: 0n,
                    feeGrowthOutside1: 0n,
                    secondsGrowthOutside: 0n,
                };
            }
            old.nextTick = upper;
            ticks[Number(oldNextTick)].previousTick = upper;
            data.tickCount++;
        }
        if (data.nearestTick < upper && upper <= data.tickAtPrice) {
            data.nearestTick = upper;
        } else if (data.nearestTick < lower && lower <= data.tickAtPrice) {
            data.nearestTick = lower;
        }
        
        return [data.nearestTick, data.tickCount];
    }
}       