import { ReservoirOrderedParams } from './types';
import { FEE_ACCURACY, RESERVE_LIMIT } from './constants';

export class ReservoirConstantProductPool {
  static getSellPrice(
    priceParams: ReservoirOrderedParams,
    amount: bigint,
  ): bigint {
    const { reservesIn, reservesOut, fee } = priceParams;

    if (BigInt(reservesIn) + amount > RESERVE_LIMIT) {
      return 0n;
    }

    const amountInWithFee = amount * (FEE_ACCURACY - BigInt(fee));

    const numerator = amountInWithFee * BigInt(reservesOut);
    const denominator = BigInt(reservesIn) * FEE_ACCURACY + amountInWithFee;

    return denominator === 0n ? 0n : numerator / denominator;
  }

  static getBuyPrice(
    priceParams: ReservoirOrderedParams,
    amount: bigint,
  ): bigint {
    const { reservesIn, reservesOut, fee } = priceParams;

    const numerator = BigInt(reservesIn) * amount * FEE_ACCURACY;
    const denominator =
      (FEE_ACCURACY - BigInt(fee)) * (BigInt(reservesOut) - amount);

    if (denominator <= 0n) return 0n;
    return numerator === 0n ? 0n : 1n + numerator / denominator;
  }
}
