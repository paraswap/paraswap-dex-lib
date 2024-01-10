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

  getSwapOut(
    state: DeepReadonly<PoolState>,
    amountIn: bigint,
    binStep: bigint,
    swapForY: boolean,
  ): bigint {
    let amountOut = 0n;
    let fee = 0n;
    let amountsInLeft = amountIn;
    // // console.log('JSON.bins', JSON.stringify(state.bins, null, 2));
    // console.log('state.liquidity: ', state.reserves);
    // console.log('activeId: ', state.activeId);

    let i = state.bins.findIndex(bin => bin.id === state.activeId);
    // console.log('activeIdIndex: ', i);
    // console.log('binAtActiveId', state.bins[i]);

    for (; i < state.bins.length; i++) {
      const bin = state.bins[i];
      const binReserves = swapForY ? bin.reserveY : bin.reserveX;
      if (binReserves >= 0n) {
        // TODO: ?
        // parameters = parameters.updateVolatilityAccumulator(id)
        const volatilityAccumulator = this.updateVolatilityAccumulator(state);
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
        // console.log(
        //   `amountsInWithFees: ${amountsInWithFees}, amountsOutOfBin: ${amountsOutOfBin}, totalFees: ${totalFees}}`,
        // );

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

  updateVolatilityAccumulator(state: DeepReadonly<PoolState>): bigint {
    const activeId = state.activeId;
    const idReference = state?.variableFeeParameters?.idReference!;
    const deltaId =
      activeId > idReference ? activeId - idReference : idReference - activeId;
    let volAcc =
      state?.variableFeeParameters?.volatilityReference +
      deltaId * this.BASIS_POINT_MAX;

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
    // if (binReserves > 0n) {
    //   console.log(
    //     `FUNC.swapForY: ${swapForY}, binReserves: ${binReserves}, binStep: ${binStep}, binId: ${binId}, amountInLeft: ${amountInLeft}`,
    //   );
    // }
    const result = [0n, 0n, 0n] as [bigint, bigint, bigint];
    const price = this.getPriceFromId(binStep, binId); // ok

    let maxAmountIn = swapForY
      ? this.shiftDivRoundUp(binReserves, this.SCALE_OFFSET, price)
      : this.mulShiftRoundUp(binReserves, price, this.SCALE_OFFSET);

    // if (binReserves > 0n) {
    //   console.log('FUNC.swapForY: ', swapForY);
    //   console.log('FUNC.price: ', price);
    //   console.log(`FUNC.maxAmountIn: ${maxAmountIn}`);
    // }

    const totalFee =
      this.getBaseFee(state, binId) +
      this.getVariableFee(state, binId, volatilityAccumulator); // ok
    // const totalFee = 46274932115421274402048800n;
    const maxFee = this.getFeeAmount(maxAmountIn, totalFee);

    // if (binReserves > 0n) {
    //   console.log('FUNC.totalFee: ', totalFee);
    //   console.log('FUNC.maxFee: ', maxFee);
    // }

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

    // console.log(`binStep: ${binStep}, id: ${id}`);
    // console.log(`Base: ${base}, exponent: ${exponent}`);
    // return BigInt(base ** Number(exponent));
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

    // Check for underflow
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

  //   getBaseFee(params: string, binStep: bigint): bigint {
  //     // Assuming getBaseFactor returns a bigint
  //     return this.getBaseFactor(params) * binStep * 1e10n;
  // }

  getBaseFee(state: DeepReadonly<PoolState>, binStep: bigint) {
    // console.log(
    //   'state?.staticFeeParameters?.baseFactor: ',
    //   state?.staticFeeParameters?.baseFactor!,
    // );
    return state?.staticFeeParameters?.baseFactor! * binStep * BigInt(1e10);
  }

  getVariableFee(
    state: DeepReadonly<PoolState>,
    binStep: bigint,
    newVolatilityAccumulator: bigint,
  ) {
    // console.log(
    //   'state?.staticFeeParameters?.variableFeeControl: ',
    //   state?.staticFeeParameters?.variableFeeControl!,
    // );
    // console.log(
    //   'state?.variableFeeParameters?.volatilityAccumulator: ',
    //   state?.variableFeeParameters?.volatilityAccumulator!,
    // );
    const variableFeeControl = state?.staticFeeParameters?.variableFeeControl!;
    if (variableFeeControl === 0n) {
      return 0n;
    }
    const prod = newVolatilityAccumulator * binStep;
    const variableFee = (prod * prod * variableFeeControl + 99n) / 100n;
    return variableFee;
  }

  getFeeAmount(maxAmountIn: bigint, totalFee: bigint) {
    // this.verifyFee(totalFee);
    const denominator = this.PRECISION - totalFee;
    return (maxAmountIn * totalFee + denominator - 1n) / denominator;
  }

  getFeeAmountFrom(amountInWithFees: bigint, totalFee: bigint) {
    // this.verifyFee(totalFee);
    return amountInWithFees * totalFee + this.PRECISION - 1n / this.PRECISION;
  }

  verifyFee(fee: bigint): void {
    if (fee > this.MAX_FEE) {
      throw new Error('FeeHelper__FeeTooLarge');
    }
  }

  shiftDivRoundUp(x: bigint, offset: bigint, denominator: bigint) {
    // return x << (offset / denominator);
    let result = this.shiftDivRoundDown(x, offset, denominator);
    if (this.mulMod(x, 1n << offset, denominator) !== 0n) {
      result += 1n;
    }
    return result;
  }

  shiftDivRoundDown(x: bigint, offset: bigint, denominator: bigint): bigint {
    const prod0 = x << offset; // Least significant 256 bits of the product
    // JavaScript doesn't support shifting of bigint more than 64 bits directly.
    // Hence, a manual method to shift is required for larger values.
    const prod1 = this.manualShiftRight(x, 256n - offset); // Most significant 256 bits of the product

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
    // Handle non-overflow cases, 256 by 256 division
    if (prod1 === 0n) {
      return prod0 / denominator;
    } else {
      // Make sure the result is less than 2^256. Also prevents denominator == 0
      if (prod1 >= denominator) {
        throw new Error('Uint256x256Math__MulDivOverflow');
      }

      // Compute remainder using mulMod.
      const remainder = this.mulMod(x, y, denominator);

      // Subtract 256 bit number from 512 bit number.
      let adjustedProd0 = prod0 - remainder;
      let adjustedProd1 = prod1 - (remainder > prod0 ? 1n : 0n);

      // Factor powers of two out of denominator and compute largest power of two divisor of denominator. Always >= 1
      const lpotdod = denominator & (~denominator + 1n);
      denominator /= lpotdod;
      adjustedProd0 /= lpotdod;

      // Shift in bits from prod1 into prod0
      adjustedProd0 |= adjustedProd1 * (2n ** 256n / lpotdod);

      // Compute modular inverse
      let inverse = (3n * denominator) ^ 2n;
      inverse = this.improvePrecision(denominator, inverse);

      // Multiply with the modular inverse of denominator
      return adjustedProd0 * inverse;
    }
  }

  manualShiftRight(x: bigint, shift: bigint): bigint {
    // Implement the logic to shift right by a large number of bits
    // Placeholder return
    return x / (1n << shift); // Simplified implementation
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
  //   // Handling division by 2 with proper flooring
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
      // Check for potential overflow
      if (prod1 >= 1n << BigInt(offset)) {
        throw new Error('Uint256x256Math__MulShiftOverflow');
      }

      result += prod1 << (256n - BigInt(offset));
    }

    return result;
  }

  getMulProds(x: bigint, y: bigint): [bigint, bigint] {
    const prod0 = x * y;
    // Calculating the higher bits of the product involves complex arithmetic that JavaScript cannot handle natively.
    // The approximation below may not be accurate for extremely large numbers.
    const prod1 = (x * y - prod0) / (1n << 256n);

    return [prod0, prod1];
  }

  ////
  // /**
  //  * Calculates floor(x * y / 2**offset) with full precision
  //  * The result will be rounded down
  //  * Requirements:
  //  * - The offset needs to be strictly lower than 256
  //  * - The result must fit within uint256
  //  * Caveats:
  //  * - This function does not work with fixed-point numbers
  //  * @param x The multiplicand as a bigint
  //  * @param y The multiplier as a bigint
  //  * @param offset The offset as a bigint, can't be greater than 256
  //  * @return The result as a bigint
  //  */
  // mulShiftRoundDown(x: bigint, y: bigint, offset: bigint): bigint {
  //   let [prod0, prod1] = this.getMulProds(x, y);
  //   let result: bigint = 0n;

  //   if (prod0 !== 0n) result = prod0 >> offset;
  //   if (prod1 !== 0n) {
  //     // Make sure the result is less than 2^256.
  //     if (prod1 >= 1n << offset) throw new Error('MulShiftOverflow');

  //     result += prod1 << (256n - offset);
  //   }

  //   return result;
  // }

  // /**
  //  * Helper function to return the result of `x * y` as 2 bigints
  //  * @param x The multiplicand as a bigint
  //  * @param y The multiplier as a bigint
  //  * @return The least and most significant 256 bits of the product
  //  */
  // getMulProds(x: bigint, y: bigint): [bigint, bigint] {
  //   const MOD = 1n << 256n;
  //   const fullProduct = x * y;
  //   const prod0 = fullProduct % MOD;
  //   const prod1 = fullProduct / MOD;

  //   return [prod0, prod1];
  // }
}
