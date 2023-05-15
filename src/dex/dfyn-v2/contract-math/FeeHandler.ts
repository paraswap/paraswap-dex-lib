import { StructHelper } from "./../types";
import { FullMath } from './FullMath';
import { TickMath } from "./TickMath";

export class FeeHandler{
    static handleFees(request: StructHelper["FeeHandlerRequest"])
    : { protocolFee: bigint, 
        feeGrowthGlobal :bigint
    } {
        
        // Calculate `protocolFee` and convert pips to bips.
        const feeDelta = FullMath.mulDivRoundingUp(request.feeAmount, request.dfynFee, BigInt(1e4));
    
        request.protocolFee += feeDelta;
    
        // Updating `request.feeAmount` based on the protocolFee.
        request.feeAmount -= feeDelta;
    
        request.feeGrowthGlobal += FullMath.mulDivRoundingUp(
            request.feeAmount,
            0x100000000000000000000000000000000n,
            request.currentLiquidity
        );
        const protocolFee = request.protocolFee;
        const feeGrowthGlobal =request.feeGrowthGlobal;
        return {protocolFee, feeGrowthGlobal};
    }
    
  

    static rangeFeeGrowth(
    ticks: Record<number, StructHelper["Tick"]>,
    lowerTick: bigint,
    upperTick: bigint,
    price: bigint,
    _feeGrowthGlobal0: bigint,
    _feeGrowthGlobal1: bigint
    ): 
    {   feeGrowthInside0:bigint,
        feeGrowthInside1:bigint 
    } {
    const currentTick = TickMath.getTickAtSqrtRatio(price);

    // Calculate fee growth below & above.
    let feeGrowthBelow0: bigint;
    let feeGrowthBelow1: bigint;
    let feeGrowthAbove0: bigint;
    let feeGrowthAbove1: bigint;

    {
        const lower = ticks[Number(lowerTick)];
        if (lowerTick <= currentTick) {
        feeGrowthBelow0 = lower.feeGrowthOutside0;
        feeGrowthBelow1 = lower.feeGrowthOutside1;
        } else {
        feeGrowthBelow0 = _feeGrowthGlobal0 - lower.feeGrowthOutside0;
        feeGrowthBelow1 = _feeGrowthGlobal1 - lower.feeGrowthOutside1;
        }
    }
    {
        const upper = ticks[Number(upperTick)];
        if (currentTick < upperTick) {
        feeGrowthAbove0 = upper.feeGrowthOutside0;
        feeGrowthAbove1 = upper.feeGrowthOutside1;
        } else {
        feeGrowthAbove0 = _feeGrowthGlobal0 - upper.feeGrowthOutside0;
        feeGrowthAbove1 = _feeGrowthGlobal1 - upper.feeGrowthOutside1;
        }
    }

    const feeGrowthInside0 =
        _feeGrowthGlobal0 - feeGrowthBelow0 - feeGrowthAbove0;
    const feeGrowthInside1 =
        _feeGrowthGlobal1 - feeGrowthBelow1 - feeGrowthAbove1;

    return {feeGrowthInside0, feeGrowthInside1};
    }

}