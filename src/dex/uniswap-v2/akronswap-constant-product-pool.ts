import { RESERVE_LIMIT } from './uniswap-v2';
import { UniswapV2PoolOrderedParams } from './types';

export class AkronswapConstantProductPool {
  static getSellPrice(
    priceParams: UniswapV2PoolOrderedParams,
    srcAmount: bigint,
  ): bigint {
    const { reservesIn, reservesOut, fee } = priceParams;

    if (BigInt(reservesIn) + srcAmount > RESERVE_LIMIT) {
      return 0n;
    }

    const numerator = srcAmount * BigInt(reservesOut);

    const denominator = srcAmount * BigInt(2) + BigInt(reservesIn);

    return denominator === 0n ? 0n : numerator / denominator;
  }

  static getBuyPrice(
    priceParams: UniswapV2PoolOrderedParams,
    destAmount: bigint,
  ): bigint {
    const { reservesIn, reservesOut, fee } = priceParams;

    const numerator = BigInt(reservesIn) * destAmount;
    const denominator = BigInt(reservesOut) - destAmount * BigInt(2);

    if (denominator <= 0n) return 0n;
    return numerator === 0n ? 0n : 1n + numerator / denominator;
  }
}
