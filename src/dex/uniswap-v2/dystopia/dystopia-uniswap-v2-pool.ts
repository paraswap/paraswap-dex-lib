import { RESERVE_LIMIT } from '../uniswap-v2';
import { UniswapV2PoolOrderedParams } from '../types';
import { BI_MAX_UINT256 } from '../../../bigint-constants';
import { SWAP_FEE_FACTOR } from './constants';

export class DystopiaUniswapV2Pool {
  // Dystopia non-stable pools has almost same formula like uniswap2,
  // but little changed in contract.
  // So we repeat formulas here to have same output.
  static async getSellPrice(
    priceParams: UniswapV2PoolOrderedParams,
    srcAmount: bigint,
  ): Promise<bigint> {
    const { reservesIn, reservesOut } = priceParams;

    if (BigInt(reservesIn) + srcAmount > RESERVE_LIMIT) {
      return 0n;
    }

    const amountInWithFee = srcAmount * (SWAP_FEE_FACTOR - 1n);

    const numerator = amountInWithFee * BigInt(reservesOut);

    const denominator = BigInt(reservesIn) * SWAP_FEE_FACTOR + amountInWithFee;

    return denominator === 0n ? 0n : numerator / denominator;
  }

  static async getBuyPrice(
    priceParams: UniswapV2PoolOrderedParams,
    destAmount: bigint,
  ): Promise<bigint> {
    const { reservesIn, reservesOut } = priceParams;

    const numerator = BigInt(reservesIn) * destAmount * SWAP_FEE_FACTOR;
    const denominator =
      (SWAP_FEE_FACTOR - 1n) * (BigInt(reservesOut) - destAmount);

    if (denominator <= 0n) return BI_MAX_UINT256;
    return 1n + numerator / denominator;
  }
}
