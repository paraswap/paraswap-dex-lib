import { DeepReadonly } from 'ts-essentials';
import { PoolState } from '../types';
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

export class TraderJoeV21Math {
  private readonly BASIS_POINT_MAX = 10_000n;
  private readonly SCALE_OFFSET = 128n;
  private readonly PRECISION = BigInt(1e18);
  private readonly REAL_ID_SHIFT = 1 << 23;
  private readonly SCALE = 1n << this.SCALE_OFFSET;
  private readonly MAX_FEE = 0.1e18; // 10%

  getSwapIn(
    state: DeepReadonly<PoolState>,
    amountOut: bigint,
    binStep: bigint,
    swapForY: boolean,
  ): bigint {
    let amountIn = 0n;
    let fee = 0n;
    let amountOutLeft = amountOut;

    const parameters = this.updateReferences(state);

    let i = state.bins.findIndex(bin => bin.id === state.activeId);

    for (; i < state.bins.length; i++) {
      const bin = state.bins[i];
      const binReserves = swapForY ? bin.reserveY : bin.reserveX;
      if (binReserves > 0n) {
        const price = this.getPriceFromId(binStep, bin.id);

        const amountOutOfBin =
          binReserves > amountOutLeft ? amountOutLeft : binReserves;
        const volatilityAccumulator = this.updateVolatilityAccumulator(
          state,
          parameters.idReference,
          parameters.volatilityReference,
        );

        const amountInWithoutFee = swapForY
          ? this.shiftDivRoundUp(amountOutOfBin, this.SCALE_OFFSET, price)
          : this.mulShiftRoundUp(amountOutOfBin, price, this.SCALE_OFFSET);

        const baseFee = this.getBaseFee(state, binStep);
        const variableFee = this.getVariableFee(
          state,
          binStep,
          volatilityAccumulator,
        );
        const totalFee = baseFee + variableFee;
        const maxFee = this.getFeeAmount(amountInWithoutFee, totalFee);

        amountIn += amountInWithoutFee + maxFee;
        amountOutLeft -= amountOutOfBin;
        fee += totalFee;
      }
      if (amountOutLeft == 0n) {
        break;
      }
    }
    return amountIn;
  }

  getSwapOut(
    state: DeepReadonly<PoolState>,
    amountIn: bigint,
    binStep: bigint,
    swapForY: boolean,
  ): bigint {
    let amountOut = 0n;
    let fee = 0n;
    let amountsInLeft = amountIn;

    const parameters = this.updateReferences(state);

    let i = state.bins.findIndex(bin => bin.id === state.activeId);

    for (; i < state.bins.length; i++) {
      const bin = state.bins[i];
      const binReserves = swapForY ? bin.reserveY : bin.reserveX;
      if (binReserves > 0n) {
        const volatilityAccumulator = this.updateVolatilityAccumulator(
          state,
          parameters.idReference,
          parameters.volatilityReference,
        );
        const [amountsInWithFees, amountsOutOfBin, totalFees] =
          this.getAmountsFromReserves(
            state,
            binStep,
            bin.id,
            amountsInLeft,
            binReserves,
            swapForY,
            volatilityAccumulator,
          );

        if (amountsInWithFees > 0n) {
          amountsInLeft -= amountsInWithFees;
          amountOut += amountsOutOfBin;
          fee += totalFees;
        }
      }
      if (amountsInLeft == 0n) {
        break;
      }
    }
    return amountOut;
  }

  updateVolatilityAccumulator(
    state: DeepReadonly<PoolState>,
    newIdReference: bigint,
    newVolatilityReference: bigint,
  ): bigint {
    const activeId = state.activeId;
    const idReference = newIdReference;
    const deltaId =
      activeId > idReference ? activeId - idReference : idReference - activeId;
    let volAcc = newVolatilityReference + deltaId * this.BASIS_POINT_MAX;

    const maxVolAcc = state?.staticFeeParameters?.maxVolatilityAccumulator;

    volAcc = volAcc > maxVolAcc ? maxVolAcc : volAcc;

    return volAcc;
  }

  getAmountsFromReserves(
    state: DeepReadonly<PoolState>,
    binStep: bigint,
    binId: bigint,
    amountInLeft: bigint,
    binReserves: bigint,
    swapForY: boolean,
    volatilityAccumulator: bigint,
  ): [bigint, bigint, bigint] {
    const result = [0n, 0n, 0n] as [bigint, bigint, bigint];
    const price = this.getPriceFromId(binStep, binId); // ok

    let maxAmountIn = swapForY
      ? this.shiftDivRoundUp(binReserves, this.SCALE_OFFSET, price)
      : this.mulShiftRoundUp(binReserves, price, this.SCALE_OFFSET);

    const baseFee = this.getBaseFee(state, binStep);
    const variableFee = this.getVariableFee(
      state,
      binStep,
      volatilityAccumulator,
    );
    const totalFee = baseFee + variableFee;
    const maxFee = this.getFeeAmount(maxAmountIn, totalFee);

    maxAmountIn += maxFee;

    let amountIn = amountInLeft;
    let fee: bigint;
    let amountOut: bigint;

    if (amountInLeft >= maxAmountIn) {
      fee = maxFee;
      amountIn = maxAmountIn;
      amountOut = binReserves;
    } else {
      fee = this.getFeeAmountFrom(amountInLeft, totalFee);

      const amountInTemp = amountIn - fee;

      amountOut = swapForY
        ? this.mulShiftRoundDown(amountInTemp, price, this.SCALE_OFFSET)
        : this.shiftDivRoundDown(amountInTemp, this.SCALE_OFFSET, price);

      if (amountOut > binReserves) {
        amountOut = binReserves;
      }
    }

    result[0] = amountIn;
    result[1] = amountOut;
    result[2] = fee;

    return result;
  }

  getPriceFromId(binStep: bigint, id: bigint) {
    const base = this.getBase(binStep);
    const exponent = BigInt(Number(id) - this.REAL_ID_SHIFT);

    return this.pow(base, exponent);
  }

  getBase(binStep: bigint) {
    return this.SCALE + (binStep << this.SCALE_OFFSET) / this.BASIS_POINT_MAX;
  }

  pow(x: bigint, y: bigint): bigint {
    let invert = false;
    let absY = y;

    if (y === 0n) return this.SCALE;

    if (y < 0n) {
      absY = -y;
      invert = !invert;
    }

    let result: bigint = this.SCALE;

    if (absY < 0x100000n) {
      let squared = x;
      if (x > 0xffffffffffffffffffffffffffffffffn) {
        squared = (BigInt(2) ** 256n - 1n) / squared;
        invert = !invert;
      }

      for (let i = 0n; i < 21n; i++) {
        if (absY & (1n << i)) {
          result = (result * squared) >> 128n;
        }
        squared = (squared * squared) >> 128n;
      }
    }

    if (result === 0n)
      throw new Error(`Uint128x128Math__PowUnderflow: x=${x}, y=${y}`);

    return invert ? (BigInt(2) ** 256n - 1n) / result : result;
  }

  getTotalFee(
    state: PoolState,
    binStep: bigint,
    newVolatilityAccumulator: bigint,
  ): bigint {
    return (
      this.getBaseFee(state, binStep) +
      this.getVariableFee(state, binStep, newVolatilityAccumulator)
    );
  }

  getBaseFee(state: DeepReadonly<PoolState>, binStep: bigint) {
    return state?.staticFeeParameters?.baseFactor! * binStep * BigInt(1e10);
  }

  getVariableFee(
    state: DeepReadonly<PoolState>,
    binStep: bigint,
    newVolatilityAccumulator: bigint,
  ) {
    const variableFeeControl = state?.staticFeeParameters?.variableFeeControl!;
    if (variableFeeControl === 0n) {
      return 0n;
    }
    const prod = newVolatilityAccumulator * binStep;
    const variableFee = (prod * prod * variableFeeControl + 99n) / 100n;
    return variableFee;
  }

  getFeeAmount(maxAmountIn: bigint, totalFee: bigint) {
    this.verifyFee(totalFee);
    const denominator = this.PRECISION - totalFee;
    return (maxAmountIn * totalFee + denominator - 1n) / denominator;
  }

  getFeeAmountFrom(amountInWithFees: bigint, totalFee: bigint) {
    this.verifyFee(totalFee);
    return (amountInWithFees * totalFee + this.PRECISION - 1n) / this.PRECISION;
  }

  verifyFee(fee: bigint): void {
    if (fee > this.MAX_FEE) {
      throw new Error('FeeHelper__FeeTooLarge');
    }
  }

  shiftDivRoundUp(x: bigint, offset: bigint, denominator: bigint) {
    let result = this.shiftDivRoundDown(x, offset, denominator);
    if (this.mulMod(x, 1n << offset, denominator) !== 0n) {
      result += 1n;
    }
    return result;
  }

  shiftDivRoundDown(x: bigint, offset: bigint, denominator: bigint): bigint {
    const prod0 = x << offset;
    const prod1 = this.manualShiftRight(x, 256n - offset);

    return this.getEndOfDivRoundDown(
      x,
      1n << offset,
      denominator,
      prod0,
      prod1,
    );
  }

  getEndOfDivRoundDown(
    x: bigint,
    y: bigint,
    denominator: bigint,
    prod0: bigint,
    prod1: bigint,
  ): bigint {
    if (prod1 === 0n) {
      return prod0 / denominator;
    } else {
      if (prod1 >= denominator) {
        throw new Error('Uint256x256Math__MulDivOverflow');
      }

      const remainder = this.mulMod(x, y, denominator);

      let adjustedProd0 = prod0 - remainder;
      let adjustedProd1 = prod1 - (remainder > prod0 ? 1n : 0n);

      const lpotdod = denominator & (~denominator + 1n);
      denominator /= lpotdod;
      adjustedProd0 /= lpotdod;

      adjustedProd0 |= adjustedProd1 * (2n ** 256n / lpotdod);

      let inverse = (3n * denominator) ^ 2n;
      inverse = this.improvePrecision(denominator, inverse);

      return adjustedProd0 * inverse;
    }
  }

  manualShiftRight(x: bigint, shift: bigint): bigint {
    return x / (1n << shift);
  }

  // TODO: Check if this is required
  // manualShiftRight(x: bigint, shift: bigint): bigint {
  //   if (shift < 0n) {
  //     throw new Error('Shift value cannot be negative');
  //   }

  //   // Directly return for shift values of 0
  //   if (shift === 0n) {
  //     return x;
  //   }

  //   let result = x;
  //   while (shift > 0n) {
  //     result = this.divideBigInt(result);
  //     shift--;
  //   }

  //   return result;
  // }

  // divideBigInt(value: bigint): bigint {
  //   return value > 0n ? value / 2n : (value - 1n) / 2n;
  // }

  mulMod(x: bigint, y: bigint, mod: bigint): bigint {
    return (x * y) % mod;
  }

  improvePrecision(denominator: bigint, inverse: bigint): bigint {
    for (let i = 0; i < 5; i++) {
      inverse *= 2n - denominator * inverse;
    }
    return inverse;
  }

  ///

  mulShiftRoundUp(x: bigint, y: bigint, offset: bigint): bigint {
    let result = this.mulShiftRoundDown(x, y, offset);
    if (this.mulMod(x, y, 1n << BigInt(offset)) !== 0n) {
      result += 1n;
    }
    return result;
  }

  mulShiftRoundDown(x: bigint, y: bigint, offset: bigint): bigint {
    const [prod0, prod1] = this.getMulProds(x, y);
    let result = prod0 >> BigInt(offset);

    if (prod1 !== 0n) {
      if (prod1 >= 1n << BigInt(offset)) {
        throw new Error('Uint256x256Math__MulShiftOverflow');
      }

      result += prod1 << (256n - BigInt(offset));
    }

    return result;
  }

  getMulProds(x: bigint, y: bigint): [bigint, bigint] {
    const prod0 = x * y;
    const prod1 = (x * y - prod0) / (1n << 256n);

    return [prod0, prod1];
  }

  updateReferences(state: DeepReadonly<PoolState>): {
    idReference: bigint;
    volatilityReference: bigint;
  } {
    const dt =
      state.blockTimestamp - state.variableFeeParameters.timeOfLastUpdate;

    let idReference: bigint | null = null;
    let volatilityReference: bigint | null = null;

    if (dt >= state.staticFeeParameters.filterPeriod) {
      idReference = state.activeId;
      volatilityReference =
        dt < state.staticFeeParameters.decayPeriod
          ? this.updateVolatilityReference(state)
          : 0n;
    }

    return {
      idReference: idReference || state.variableFeeParameters.idReference,
      volatilityReference:
        volatilityReference || state.variableFeeParameters.volatilityReference,
    };

    // TODO: Do we need it for pricing?
    // return updateTimeOfLastUpdate(params, timestamp); // Assuming updateTimeOfLastUpdate is implemented
  }

  updateVolatilityReference(state: DeepReadonly<PoolState>): bigint {
    const volAcc = state.variableFeeParameters.volatilityAccumulator;
    const reductionFactor = state.staticFeeParameters.reductionFactor;

    const volRef = BigInt.asUintN(
      24,
      (volAcc * reductionFactor) / this.BASIS_POINT_MAX,
    );
    return volRef;
  }
}
