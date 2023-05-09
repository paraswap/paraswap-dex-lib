import { BI_POWS } from '../../../bigint-constants';
//import { ILimitOrderStruct } from "./ILimitOrder";
import { StructHelper, PoolState } from "./../types";
import { DyDxMath } from "./DyDxMath";
import { FullMath } from "./FullMath";
import { UnsafeMath } from "./UnsafeMath";
import { Ticks } from "./Ticks"


export class SwapExecuter {
    
    static _executeConcentrateLiquidity(
        cache: StructHelper["ConcStruct"],
        zeroForOne: boolean,
        nextTickPrice: bigint,
        swapFee: bigint
    ): 
    {
        amountOut:bigint;
        currentPrice :bigint;
        cross:boolean;
        amountIn:bigint;
        fee:bigint
    }{
    let amountOut= 0n;
    let currentPrice= 0n;
    let cross = false ;
    let amountIn =  0n;
    let fee = 0n;
    
    if (cache.exactIn) {
        [amountOut, currentPrice, cross, amountIn, fee] = SwapExecuter.swapExactIn(
        cache,
        zeroForOne,
        nextTickPrice,
        Number(swapFee)
        );
    } else {
        [amountOut, currentPrice, cross, amountIn, fee] = SwapExecuter.swapExactOut(
        cache,
        zeroForOne,
        nextTickPrice,
        Number(swapFee)
        );
    }
    
    return {amountOut, currentPrice, cross, amountIn, fee};
    
    }

    static swapExactOut(
        cache: StructHelper["ConcStruct"],
        zeroForOne: boolean,
        nextTickPrice: bigint,
        swapFee: number
    ) : [bigint,bigint,boolean,bigint,bigint] {
    const swapExecute: StructHelper["SwapExecuteCache"] = {} as any;
    swapExecute.amountIn = cache.amountIn;
    if (zeroForOne) {
        swapExecute.max = DyDxMath.getDy(
        cache.currentLiquidity,
        nextTickPrice,
        cache.currentPrice,
        false
        );
    
        if (cache.amountOut <= swapExecute.max) {
        swapExecute.newPrice =
            cache.currentPrice -
            FullMath.mulDiv(
            cache.amountOut,
            BigInt(0x1000000000000000000000000),
            cache.currentLiquidity
            );
    
        cache.amountIn = DyDxMath.getDx(
            cache.currentLiquidity,
            swapExecute.newPrice,
            cache.currentPrice,
            false
        );
    
        swapExecute.fee = FullMath.mulDiv(
            cache.amountIn,
            BigInt(swapFee),
            BigInt(1e6 - swapFee)
        );
    
        cache.amountIn += swapExecute.fee;
    
        return [
            BigInt(0),
            swapExecute.newPrice,
            false,
            cache.amountIn,
            swapExecute.fee,
        ];
        } else {
        cache.amountOut -= swapExecute.max;
    
        cache.amountIn = DyDxMath.getDx(
            cache.currentLiquidity,
            nextTickPrice,
            cache.currentPrice,
            false
        );
    
        swapExecute.fee = FullMath.mulDiv(
            cache.amountIn,
            BigInt(swapFee),
            BigInt(1e6 - swapFee)
        );
    
        if (swapExecute.fee > cache.amountIn) {
            swapExecute.fee = cache.amountIn;
        }
    
        cache.amountIn += swapExecute.fee;
    
        return [
            cache.amountOut,
            nextTickPrice,
            true,
            cache.amountIn,
            swapExecute.fee,
        ];
        }
    } else {

        swapExecute.max = DyDxMath.getDx(
            cache.currentLiquidity,
            cache.currentPrice,
            nextTickPrice,
            false
        );
        if (cache.amountOut <= swapExecute.max) {

        const liquidityPadded = cache.currentLiquidity * BigInt(2 ** 96);

        swapExecute.newPrice = FullMath.mulDiv(
            liquidityPadded,
            BigInt(cache.currentPrice),
            (liquidityPadded - BigInt(cache.amountOut) * BigInt(cache.currentPrice))
        );

        if (!(cache.currentPrice < swapExecute.newPrice && swapExecute.newPrice <= nextTickPrice))
        {
            swapExecute.newPrice = UnsafeMath.divRoundingUp(
                    liquidityPadded,
                    liquidityPadded / BigInt(cache.currentPrice) - BigInt(cache.amountOut));
        }

        cache.amountIn = DyDxMath.getDy(
            cache.currentLiquidity,
            cache.currentPrice,
            swapExecute.newPrice,
            false
        );
        
        swapExecute.fee = FullMath.mulDiv(
            cache.amountIn,
            BigInt(swapFee),
            BigInt(1e6 - swapFee)
        );
        cache.amountIn += swapExecute.fee;
        return [BigInt(0), swapExecute.newPrice, false, cache.amountIn, swapExecute.fee];

        } else {
        cache.amountOut -= swapExecute.max;
        cache.amountIn = DyDxMath.getDy(
            cache.currentLiquidity,
            cache.currentPrice,
            nextTickPrice,
            false
        );   
        swapExecute.fee = FullMath.mulDiv(
            cache.amountIn,
            BigInt(swapFee),
            BigInt(1e6 - swapFee)
        );
        if (swapExecute.fee > cache.amountIn) swapExecute.fee = cache.amountIn;
        cache.amountIn += swapExecute.fee;
        return [cache.amountOut, nextTickPrice, true, cache.amountIn, swapExecute.fee];
        }
    }
    
    

    }

    static swapExactIn(
        cache: StructHelper["ConcStruct"],
        zeroForOne: boolean,
        nextTickPrice: bigint,
        swapFee: number,
    ): [bigint,bigint,boolean,bigint,bigint]
    {
    const swapExecute: StructHelper["SwapExecuteCache"] = {} as any;
    swapExecute.amountIn = cache.amountIn;

    if (zeroForOne) {
        swapExecute.max = DyDxMath.getDx(
            cache.currentLiquidity,
            nextTickPrice,
            cache.currentPrice,
            false
        );
        cache.amountIn = FullMath.mulDiv(
            cache.amountIn,
            BigInt(1e6 - swapFee), BigInt(1e6)
        );

        if (cache.amountIn <= swapExecute.max) {
        const liquidityPadded = cache.currentLiquidity << 96n;

        swapExecute.newPrice = FullMath.mulDiv(
            BigInt(liquidityPadded),
            cache.currentPrice,
            BigInt(liquidityPadded + cache.currentPrice * cache.amountIn)
        );

        if (!(nextTickPrice <= swapExecute.newPrice && swapExecute.newPrice < cache.currentPrice)) {
            swapExecute.newPrice = UnsafeMath.divRoundingUp(
                BigInt(liquidityPadded),
                liquidityPadded / cache.currentPrice + cache.amountIn,
            );
        }

        cache.amountOut = DyDxMath.getDy(
            cache.currentLiquidity,
            swapExecute.newPrice,
            cache.currentPrice,
            false
        );

        swapExecute.fee = FullMath.mulDiv(swapExecute.amountIn, BigInt(swapFee), BigInt(1e6));

        return [cache.amountOut, swapExecute.newPrice, false, BigInt(0), swapExecute.fee];

        } else {
        cache.amountOut = DyDxMath.getDy(
            cache.currentLiquidity,
            nextTickPrice,
            cache.currentPrice,
            false
        );
        cache.amountIn = swapExecute.amountIn - swapExecute.max;

        swapExecute.fee = FullMath.mulDiv(
            swapExecute.max,
            BigInt(swapFee),
            BigInt(1e6 - swapFee)
        );

        if (swapExecute.fee > cache.amountIn) {
            swapExecute.fee = cache.amountIn;
            cache.amountIn = 0n;
        } else {
            cache.amountIn = cache.amountIn - swapExecute.fee;
        }

        return [cache.amountOut, nextTickPrice, true, cache.amountIn, swapExecute.fee];
    }
    } else {
    // Price is increasing.
    // Maximum swap amount within the current tick range: Δy = Δ√P · L.
        swapExecute.max = DyDxMath.getDy(cache.currentLiquidity, cache.currentPrice, nextTickPrice, false);
        cache.amountIn = FullMath.mulDivRoundingDown(
            cache.amountIn,
            BigInt(1e6 - swapFee),
            BigInt(1e6)
        );

        if (cache.amountIn <= swapExecute.max) {
            // We can swap within the current range.
            // Calculate new price after swap: ΔP = Δy/L.
            // if (swapExecute.newPrice != nextTickPrice)
            swapExecute.newPrice =
                cache.currentPrice +
                    FullMath.mulDiv(
                        cache.amountIn,
                        BigInt(0x1000000000000000000000000),
                        cache.currentLiquidity
                    );
            // Calculate output of swap
            // - Δx = Δ(1/√P) · L.
            cache.amountOut = DyDxMath.getDx(cache.currentLiquidity, cache.currentPrice, swapExecute.newPrice, false);
            swapExecute.fee = FullMath.mulDiv(
                swapExecute.amountIn, BigInt(swapFee),
                BigInt(1e6)
            );
            return [cache.amountOut, swapExecute.newPrice, false, BigInt(0), swapExecute.fee];
        } else {
            // Swap & cross the tick.
            cache.amountOut = DyDxMath.getDx(
                cache.currentLiquidity,
                cache.currentPrice,
                nextTickPrice,
                false
            );

            cache.amountIn = swapExecute.amountIn - swapExecute.max;
            swapExecute.fee = FullMath.mulDiv(
                swapExecute.max,
                BigInt(swapFee),
                BigInt(1e6 - swapFee)
            );

            if (swapExecute.fee > cache.amountIn) [swapExecute.fee, cache.amountIn] = [cache.amountIn, 0n];
            else cache.amountIn = cache.amountIn - swapExecute.fee;
            return [cache.amountOut, BigInt(nextTickPrice), true, cache.amountIn, swapExecute.fee];
        }

    }
    }
  
  static _executeLimitOrder(
    data: StructHelper["ExecuteLimitOrderParams"],
    limitOrderTicks: PoolState["limitOrderTicks"],
    limitOrderLiquidity: bigint
  ): StructHelper["ExecuteLimitResponse"]{
    let feeAmount: bigint;
    let amountIn: bigint;
    let amountOut: bigint;
    let limitOrderAmountOut: bigint;
    let limitOrderAmountIn: bigint;
    let cross: boolean;
  
    // Call the excecuteLimitOrder function and unpack its results
    [feeAmount, amountIn, amountOut, limitOrderAmountOut, limitOrderAmountIn, cross] = Ticks.excecuteLimitOrder(limitOrderTicks, data, limitOrderLiquidity);
  
    const response: StructHelper["ExecuteLimitResponse"] = {
      amountIn,
      amountOut,
      cross,
      token0LimitOrderFee: data.token0LimitOrderFee,
      token1LimitOrderFee: data.token1LimitOrderFee,
      limitOrderAmountOut,
      limitOrderAmountIn,
    };
  
    // Calculate the fee for the limit order
    if (data.zeroForOne) {
      response.token0LimitOrderFee += feeAmount;
    } else {
      response.token1LimitOrderFee += feeAmount;
    }
  
    return response;
  }
  
  static updatePosition(
    positions: Record<string, Record<number, Record<number, StructHelper['Position']>>>,
    owner: string,
    lower: number,
    upper: number,
    amount: bigint,
    rangeFeeGrowth0: bigint,
    rangeFeeGrowth1: bigint,
    maxTickLiquidity: number
): { amount0Fees: bigint, amount1Fees: bigint } {
    const position = positions[owner][lower][upper];
    const positionLiquidity = position.liquidity;
    const amount0Fees = FullMath.mulDiv(
        rangeFeeGrowth0 - BigInt(position.feeGrowthInside0Last),
        BigInt(positionLiquidity),
        BigInt('0x100000000000000000000000000000000')
    );

    const amount1Fees = FullMath.mulDiv(
        rangeFeeGrowth1 - BigInt(position.feeGrowthInside1Last),
        BigInt(positionLiquidity),
        BigInt('0x100000000000000000000000000000000')
    );

    if (amount < 0) {
        position.liquidity -= -amount;
    }

    if (amount > 0) {
        position.liquidity += amount;
        // Prevents a global liquidity overflow in even if all ticks are initialised.
        if (position.liquidity > maxTickLiquidity) {
            throw new Error('LiquidityOverflow');
        }
    }

    if (amount <= 0 && position.liquidity == 0n) {
        delete positions[owner][lower][upper];
    } else {
        position.feeGrowthInside0Last = rangeFeeGrowth0;
        position.feeGrowthInside1Last = rangeFeeGrowth1;
    }

    return { amount0Fees, amount1Fees };
}


}

  