import { RESERVE_LIMIT } from '../uniswap-v2';
import { UniswapV2PoolOrderedParams } from '../types';
import { BI_MAX_UINT } from '../../../bigint-constants';

export class ConeUniswapV2Pool {
  // Cone non-stable pools has almost same formula like uniswap2,
  // but little changed in contract.
  // So we repeat formulas here to have same output.
  static async getSellPrice(
    priceParams: UniswapV2PoolOrderedParams,
    srcAmount: bigint,
  ): Promise<bigint> {
    if (srcAmount === 0n) return 0n;
    const { reservesIn, reservesOut, fee } = priceParams;
    const feeBI = BigInt(fee);
    console.log('ConeUniswapV2Pool fee', fee);

    if (BigInt(reservesIn) + srcAmount > RESERVE_LIMIT) {
      return 0n;
    }

    const amountInWithFee = srcAmount * (feeBI - 1n);

    const numerator = amountInWithFee * BigInt(reservesOut);

    const denominator = BigInt(reservesIn) * feeBI + amountInWithFee;

    return denominator === 0n ? 0n : numerator / denominator;
  }

  static async getBuyPrice(
    priceParams: UniswapV2PoolOrderedParams,
    destAmount: bigint,
  ): Promise<bigint> {
    const { reservesIn, reservesOut, fee } = priceParams;
    const feeBI = BigInt(fee);

    const numerator = BigInt(reservesIn) * destAmount * feeBI;
    const denominator = (feeBI - 1n) * (BigInt(reservesOut) - destAmount);

    if (denominator <= 0n) return BI_MAX_UINT;
    return 1n + numerator / denominator;
  }
}
