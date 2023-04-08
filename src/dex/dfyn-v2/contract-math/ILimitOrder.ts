import { IConcentratedLiquidityPoolStruct } from "./IConcentratedLiquidityPool";

export interface ILimitOrderStruct{
    ConcStruct: ConcStruct;
    CreateLimitOrderParams : CreateLimitOrderParams;
    ExecuteLimitOrderParams : ExecuteLimitOrderParams;
    LimitOrder : LimitOrder;
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
    };

interface LimitOrderStatus {
      closed: number;
      active: number;
    };

interface LimitOrder {
      pool: IConcentratedLiquidityPoolStruct;
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

  