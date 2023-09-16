import { ReservoirOrderedParams } from './types';
import { A_PRECISION, FEE_ACCURACY, RESERVE_LIMIT } from './constants';
import { MathUtil } from '../nerve/utils';

export class ReservoirStablePool {
  static readonly CONVERGENCE_ERROR_PREFIX = 'didnt_converge';
  static readonly STABLE_DATA_ERROR = 'stable_data_absent';
  static readonly AMP_COEFFICIENT_ZERO = 'amp_coeff_zero';
  static readonly MAX_LOOP_LIMIT = 256;

  static getSellPrice(
    priceParams: ReservoirOrderedParams,
    amount: bigint,
  ): bigint {
    if (!priceParams.stable) throw new Error(this.STABLE_DATA_ERROR);
    if (priceParams.stable.ampCoefficient === 0n)
      throw new Error(this.AMP_COEFFICIENT_ZERO);
    if (BigInt(priceParams.reservesIn) + amount > RESERVE_LIMIT) {
      return 0n;
    }
    const N_A = 2n * priceParams.stable.ampCoefficient;
    const adjustedReservesIn =
      BigInt(priceParams.reservesIn) * priceParams.stable.decimalsIn;
    const adjustedReservesOut =
      BigInt(priceParams.reservesOut) * priceParams.stable.decimalsOut;
    const feeDeductedAmountIn =
      amount - (amount * BigInt(priceParams.fee)) / FEE_ACCURACY;
    const d = ReservoirStablePool.computeLiquidity(
      adjustedReservesIn,
      adjustedReservesOut,
      N_A,
    );

    const x =
      adjustedReservesIn + feeDeductedAmountIn * priceParams.stable.decimalsIn;
    const y = ReservoirStablePool.getY(x, d, N_A);

    let dy = adjustedReservesOut - y - 1n;
    dy /= priceParams.stable.decimalsOut;

    return dy;
  }

  static getBuyPrice(
    priceParams: ReservoirOrderedParams,
    amount: bigint,
  ): bigint {
    if (!priceParams.stable) throw new Error(this.STABLE_DATA_ERROR);
    if (priceParams.stable.ampCoefficient === 0n)
      throw new Error(this.AMP_COEFFICIENT_ZERO);
    const N_A = 2n * priceParams.stable.ampCoefficient;

    const adjustedReservesIn =
      BigInt(priceParams.reservesIn) * priceParams.stable.decimalsIn;
    const adjustedReservesOut =
      BigInt(priceParams.reservesOut) * priceParams.stable.decimalsOut;
    const d = ReservoirStablePool.computeLiquidity(
      adjustedReservesIn,
      adjustedReservesOut,
      N_A,
    );

    const y = adjustedReservesOut - amount * priceParams.stable.decimalsOut;
    const x = this.getY(y, d, N_A);
    let dx = x - adjustedReservesIn + 1n;
    dx /= priceParams.stable.decimalsIn;

    dx = (dx * (FEE_ACCURACY + BigInt(priceParams.fee))) / FEE_ACCURACY;

    return dx;
  }

  static computeLiquidity(xp0: bigint, xp1: bigint, N_A: bigint): bigint {
    const s = xp0 + xp1;
    if (s === 0n) return 0n;

    let prevD;
    let D = s;
    [xp0, xp1] = xp0 < xp1 ? [xp0, xp1] : [xp1, xp0];
    for (let i = 0; i < this.MAX_LOOP_LIMIT; ++i) {
      let dP = (((D * D) / xp0) * D) / xp1 / 4n;
      prevD = D;
      D =
        (((N_A * s) / A_PRECISION + 2n * dP) * D) /
        (((N_A - A_PRECISION) * D) / A_PRECISION + 3n * dP);
      if (MathUtil.within1(D, prevD)) {
        return D;
      }
    }
    throw new Error(
      `${ReservoirStablePool.CONVERGENCE_ERROR_PREFIX}_computeLiquidity`,
    );
  }

  static getY(x: bigint, D: bigint, N_A: bigint) {
    let c = (D * D) / (x * 2n);
    c = (c * D * A_PRECISION) / (N_A * 2n);
    const b = x + (D * A_PRECISION) / N_A;
    let yPrev;
    let y = D;
    for (let i = 0; i < ReservoirStablePool.MAX_LOOP_LIMIT; ++i) {
      yPrev = y;
      y = (y * y + c) / (y * 2n + b - D);
      if (MathUtil.within1(y, yPrev)) {
        return y;
      }
    }

    throw new Error(`${ReservoirStablePool.CONVERGENCE_ERROR_PREFIX}_getY`);
  }
}
