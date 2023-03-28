import { PoolState, Bin } from '../types';
import { MaverickBinMap, Active } from './maverick-bin-map';
import { BI_POWS } from '../../../bigint-constants';
import { _require } from '../../../utils';
import { MMath } from './maverick-basic-math';
import { MAX_SWAP_ITERATION_CALCULATION } from '../constants';

const MAX_TICK = 460540;

type Delta = {
  deltaInBinInternal: bigint;
  deltaInErc: bigint;
  deltaOutErc: bigint;
  excess: bigint;
  tokenAIn: boolean;
  endSqrtPrice: bigint;
  exactOutput: boolean;
  swappedToMaxPrice: boolean;
  skipCombine: boolean;
  decrementTick: boolean;
  sqrtPriceLimit: bigint;
  sqrtLowerTickPrice: bigint;
  sqrtUpperTickPrice: bigint;
  sqrtPrice: bigint;
};

export class MaverickPoolMath {
  state: PoolState;

  constructor(
    private dexKey: string,
    private fee: bigint,
    private tickSpacing: bigint,
    private protocolFeeRatio: bigint,
  ) {
    this.state = {
      activeTick: 0n,
      binCounter: 0n,
      bins: {},
      binPositions: {},
      binMap: {},
    };
  }

  combine(self: Delta, delta: Delta) {
    if (!self.skipCombine) {
      self.deltaInBinInternal += delta.deltaInBinInternal;
      self.deltaInErc += delta.deltaInErc;
      self.deltaOutErc += delta.deltaOutErc;
    }
    self.excess = delta.excess;
    self.decrementTick = delta.decrementTick;
    self.endSqrtPrice = delta.endSqrtPrice;
    self.swappedToMaxPrice = delta.swappedToMaxPrice;
  }
  pastMaxPrice(self: Delta) {
    self.swappedToMaxPrice =
      self.sqrtPriceLimit != 0n &&
      (self.tokenAIn
        ? self.sqrtPriceLimit <= self.sqrtPrice
        : self.sqrtPriceLimit >= self.sqrtPrice);
  }
  sqrtEdgePrice(self: Delta) {
    return self.tokenAIn ? self.sqrtUpperTickPrice : self.sqrtLowerTickPrice;
  }
  noSwapReset(self: Delta) {
    self.excess = 0n;
    self.skipCombine = true;
    self.endSqrtPrice = self.sqrtPrice;
  }

  swap(
    state: PoolState,
    amount: bigint,
    tokenAIn: boolean,
    exactOutput: boolean,
    // We must not restrict in current implementation tick calculations in case
    // if swap was called for event calculation
    isForPricing = false,
  ): [bigint, bigint] {
    this.state = state;
    let delta: Delta = {
      deltaInBinInternal: 0n,
      deltaInErc: 0n,
      deltaOutErc: 0n,
      excess: amount,
      tokenAIn: tokenAIn,
      endSqrtPrice: 0n,
      exactOutput: exactOutput,
      swappedToMaxPrice: false,
      skipCombine: false,
      decrementTick: false,
      sqrtPriceLimit: 0n,
      sqrtLowerTickPrice: 0n,
      sqrtUpperTickPrice: 0n,
      sqrtPrice: 0n,
    };
    let counter = 0;
    while (delta.excess > 0) {
      let newDelta = this.swapTick(delta);
      this.combine(delta, newDelta);

      // We can not do too much iteration. This variable chosen
      // as reasonable threshold
      if (isForPricing && counter++ > MAX_SWAP_ITERATION_CALCULATION) {
        return [0n, 0n];
      }
    }
    let amountIn = delta.deltaInErc;
    let amountOut = delta.deltaOutErc;
    return [amountIn, amountOut];
  }
  _nothingToSwap(
    binReserveA: bigint,
    binReserveB: bigint,
    tokenAIn: boolean,
  ): boolean {
    return (binReserveB == 0n && tokenAIn) || (binReserveA == 0n && !tokenAIn);
  }

  swapTick(delta: Delta): Delta {
    let activeTick: bigint = delta.decrementTick
      ? this.state.activeTick - 1n
      : this.state.activeTick;

    const active: Active = MaverickBinMap.getKindsAtTick(
      this.state.binMap,
      activeTick,
    );

    if (active.word == 0n) {
      activeTick = MaverickBinMap.nextActive(
        this.state.binMap,
        activeTick,
        delta.tokenAIn,
      );
    }

    let currentReserveA: bigint;
    let currentReserveB: bigint;
    let currentLiquidity: bigint;
    let currentBins: Bin[];
    [
      currentReserveA,
      currentReserveB,
      delta.sqrtPrice,
      currentLiquidity,
      currentBins,
    ] = this.currentTickLiquidity(activeTick);

    delta.sqrtLowerTickPrice = this.tickPrice(this.tickSpacing, activeTick);
    delta.sqrtUpperTickPrice = this.tickPrice(
      this.tickSpacing,
      activeTick + 1n,
    );

    this.pastMaxPrice(delta);
    if (delta.swappedToMaxPrice) {
      this.noSwapReset(delta);
      return delta;
    }
    this.state.activeTick = activeTick;

    let newDelta: Delta;

    let limitInBin =
      (delta.tokenAIn &&
        delta.sqrtPriceLimit >= delta.sqrtPrice &&
        delta.sqrtPriceLimit <= delta.sqrtUpperTickPrice) ||
      (!delta.tokenAIn &&
        delta.sqrtPriceLimit <= delta.sqrtPrice &&
        delta.sqrtPriceLimit >= delta.sqrtLowerTickPrice);
    if (delta.exactOutput) {
      newDelta = this.computeSwapExactOut(
        delta.sqrtPrice,
        currentLiquidity,
        currentReserveA,
        currentReserveB,
        delta.excess,
        delta.tokenAIn,
      );
    } else {
      newDelta = this.computeSwapExactIn(
        limitInBin ? delta.sqrtPriceLimit : this.sqrtEdgePrice(delta),
        delta.sqrtPrice,
        currentLiquidity,
        currentReserveA,
        currentReserveB,
        delta.excess,
        limitInBin,
        delta.tokenAIn,
      );
    }

    currentBins.forEach((bin: Bin) => {
      this.adjustAB(
        bin,
        newDelta,
        currentReserveB > 0n ? bin.reserveB : bin.reserveA,
        currentReserveB > 0n ? currentReserveB : currentReserveA,
      );
    });
    if (newDelta.excess != 0n) {
      this.state.activeTick += newDelta.tokenAIn ? 1n : 0n;
      newDelta.decrementTick = !delta.tokenAIn;
    }
    return newDelta;
  }

  adjustAB(bin: Bin, delta: Delta, thisBinAmount: bigint, totalAmount: bigint) {
    let deltaIn;
    let deltaOut = 0n;

    deltaIn = MMath.mulDiv(
      delta.deltaInBinInternal,
      thisBinAmount,
      totalAmount,
      false,
    );
    if (delta.excess == 0n) {
      deltaOut = MMath.mulDiv(
        delta.deltaOutErc,
        thisBinAmount,
        totalAmount,
        true,
      );
    }

    if (delta.tokenAIn) {
      bin.reserveA += deltaIn;
      bin.reserveB =
        delta.excess > 0n ? 0n : MMath.clip(bin.reserveB, deltaOut);
    } else {
      bin.reserveB += deltaIn;
      bin.reserveA =
        delta.excess > 0n ? 0n : MMath.clip(bin.reserveA, deltaOut);
    }
  }

  _deltaAmount(
    liquidity: bigint,
    lowerSqrtPrice: bigint,
    upperSqrtPrice: bigint,
    isA: boolean,
  ): bigint {
    return isA
      ? MMath.mul(liquidity, upperSqrtPrice - lowerSqrtPrice)
      : MMath.div(liquidity, lowerSqrtPrice) -
          MMath.div(liquidity, upperSqrtPrice);
  }

  _amountToBin(deltaInErc: bigint, feeBases: bigint): bigint {
    return this.protocolFeeRatio != 0n
      ? MMath.clip(
          deltaInErc,
          MMath.mul(feeBases, this.protocolFeeRatio * BI_POWS[15]) + 1n,
        )
      : deltaInErc;
  }

  computeSwapExactIn(
    sqrtEdgePrice: bigint,
    sqrtPrice: bigint,
    liquidity: bigint,
    reserveA: bigint,
    reserveB: bigint,
    amountIn: bigint,
    limitInBin: boolean,
    tokenAIn: boolean,
  ): Delta {
    let binAmountIn;
    binAmountIn = tokenAIn
      ? this._deltaAmount(liquidity, sqrtPrice, sqrtEdgePrice, true)
      : this._deltaAmount(liquidity, sqrtEdgePrice, sqrtPrice, false);
    let feeBasis;
    let swapped;

    let delta: Delta = {
      deltaInBinInternal: 0n,
      deltaInErc: 0n,
      deltaOutErc: 0n,
      excess: 0n,
      tokenAIn: tokenAIn,
      endSqrtPrice: 0n,
      exactOutput: false,
      swappedToMaxPrice: false,
      decrementTick: false,
      skipCombine: false,
      sqrtPriceLimit: 0n,
      sqrtLowerTickPrice: 0n,
      sqrtUpperTickPrice: 0n,
      sqrtPrice: 0n,
    };
    if (MMath.mul(amountIn, BI_POWS[18] - this.fee) >= binAmountIn) {
      feeBasis = MMath.mulDiv(
        binAmountIn,
        this.fee,
        BI_POWS[18] - this.fee,
        true,
      );
      delta.deltaInErc = binAmountIn + feeBasis;
      if (limitInBin) {
        delta.swappedToMaxPrice = true;
      } else {
        delta.endSqrtPrice = sqrtEdgePrice;
        delta.deltaOutErc = tokenAIn ? reserveB : reserveA;
        delta.excess = MMath.clip(amountIn, delta.deltaInErc);
      }
    } else {
      binAmountIn = MMath.mul(amountIn, BI_POWS[18] - this.fee);
      delta.deltaInErc = amountIn;
      feeBasis = delta.deltaInErc - binAmountIn;
    }
    delta.deltaInBinInternal = this._amountToBin(delta.deltaInErc, feeBasis);
    if (delta.excess != 0n || liquidity == 0n) return delta;

    delta.deltaOutErc = MMath.min(
      tokenAIn ? reserveB : reserveA,
      MMath.mulDiv(
        binAmountIn,
        tokenAIn ? MMath.inv(sqrtPrice) : sqrtPrice,
        MMath.div(binAmountIn, liquidity) +
          (tokenAIn ? sqrtPrice : MMath.inv(sqrtPrice)),
        false,
      ),
    );
    delta.endSqrtPrice =
      MMath.div(binAmountIn, liquidity) +
      (tokenAIn ? sqrtPrice : MMath.inv(sqrtPrice));
    if (!tokenAIn) {
      delta.endSqrtPrice = MMath.inv(delta.endSqrtPrice);
    }
    return delta;
  }

  computeSwapExactOut(
    sqrtPrice: bigint,
    liquidity: bigint,
    reserveA: bigint,
    reserveB: bigint,
    amountOut: bigint,
    tokenAIn: boolean,
  ): Delta {
    const amountOutAvailable = tokenAIn ? reserveB : reserveA;
    const swapped = amountOutAvailable <= amountOut;
    let delta: Delta = {
      deltaInBinInternal: 0n,
      deltaInErc: 0n,
      deltaOutErc: 0n,
      excess: 0n,
      tokenAIn: tokenAIn,
      endSqrtPrice: 0n,
      exactOutput: true,
      decrementTick: false,
      swappedToMaxPrice: false,
      skipCombine: false,
      sqrtPriceLimit: 0n,
      sqrtLowerTickPrice: 0n,
      sqrtUpperTickPrice: 0n,
      sqrtPrice: 0n,
    };
    delta.deltaOutErc = MMath.min(amountOut, amountOutAvailable);
    let binAmountIn;
    binAmountIn = MMath.mulDiv(
      delta.deltaOutErc,
      tokenAIn ? sqrtPrice : MMath.inv(sqrtPrice),
      (tokenAIn ? MMath.inv(sqrtPrice) : sqrtPrice) -
        MMath.div(delta.deltaOutErc, liquidity),
      true,
    );
    delta.endSqrtPrice =
      (tokenAIn ? MMath.inv(sqrtPrice) : sqrtPrice) -
      MMath.div(delta.deltaOutErc, liquidity);
    if (tokenAIn) {
      delta.endSqrtPrice = MMath.inv(delta.endSqrtPrice);
    }

    const feeBasis = MMath.mulDiv(
      binAmountIn,
      this.fee,
      BI_POWS[18] - this.fee,
      true,
    );
    delta.deltaInErc = binAmountIn + feeBasis;
    delta.deltaInBinInternal = this._amountToBin(delta.deltaInErc, feeBasis);
    delta.excess = swapped ? MMath.clip(amountOut, delta.deltaOutErc) : 0n;
    return delta;
  }

  currentTickLiquidity(
    activeTick: bigint,
  ): [bigint, bigint, bigint, bigint, Bin[]] {
    const active: Active = MaverickBinMap.getKindsAtTick(
      this.state.binMap,
      activeTick,
    );

    let reserveA: bigint = 0n;
    let reserveB: bigint = 0n;
    let bins: Bin[] = [];

    for (let i = 0n; i < 4n; i++) {
      if ((active.word & (1n << i)) > 0) {
        if (!this.state.binPositions[activeTick.toString()]) {
          this.state.binPositions[activeTick.toString()] = {};
        }
        let binId: bigint =
          this.state.binPositions[activeTick.toString()][i.toString()] || 0n;
        if (binId > 0n) {
          const bin: Bin = this.state.bins[binId.toString()];
          reserveA += bin.reserveA;
          reserveB += bin.reserveB;
          bins.push(bin);
        }
      }
    }

    const sqrtLowerTickPrice = this.tickPrice(this.tickSpacing, activeTick);
    const sqrtUpperTickPrice = this.tickPrice(
      this.tickSpacing,
      activeTick + 1n,
    );

    const [sqrtPrice, liquidity]: [bigint, bigint] = this.getTickSqrtPriceAndL(
      reserveA,
      reserveB,
      sqrtLowerTickPrice,
      sqrtUpperTickPrice,
    );

    return [reserveA, reserveB, sqrtPrice, liquidity, bins];
  }

  getTickL(
    _reserveA: bigint,
    _reserveB: bigint,
    _sqrtLowerTickPrice: bigint,
    _sqrtUpperTickPrice: bigint,
  ): bigint {
    let precisionBump = 0n;
    if (_reserveA >> 60n == 0n && _reserveB >> 60n == 0n) {
      precisionBump = 40n;
      _reserveA <<= precisionBump;
      _reserveB <<= precisionBump;
    }
    if (_reserveA == 0n || _reserveB == 0n) {
      let b =
        MMath.div(_reserveA, _sqrtUpperTickPrice) +
        MMath.mul(_reserveB, _sqrtLowerTickPrice);
      return (
        MMath.mulDiv(
          b,
          _sqrtUpperTickPrice,
          _sqrtUpperTickPrice - _sqrtLowerTickPrice,
          false,
        ) >> precisionBump
      );
    } else {
      let b =
        MMath.div(_reserveA, _sqrtUpperTickPrice) +
        MMath.mul(_reserveB, _sqrtLowerTickPrice);
      b >>= 1n;
      let diff = _sqrtUpperTickPrice - _sqrtLowerTickPrice;
      return (
        MMath.mulDiv(
          b +
            MMath.sqrt(
              MMath.mul(b, b) +
                MMath.mulDiv(
                  MMath.mul(_reserveB, _reserveA),
                  diff,
                  _sqrtUpperTickPrice,
                  false,
                ),
            ),
          _sqrtUpperTickPrice,
          diff,
          false,
        ) >> precisionBump
      );
    }
  }

  getTickSqrtPriceAndL(
    reserveA: bigint,
    reserveB: bigint,
    sqrtLowerTickPrice: bigint,
    sqrtUpperTickPrice: bigint,
  ): [bigint, bigint] {
    const liquidity = this.getTickL(
      reserveA,
      reserveB,
      sqrtLowerTickPrice,
      sqrtUpperTickPrice,
    );
    _require(liquidity >= 0n, 'Invalid Liquidity');
    if (reserveA == 0n) {
      return [sqrtLowerTickPrice, liquidity];
    }
    if (reserveB == 0n) {
      return [sqrtUpperTickPrice, liquidity];
    }

    const qo = MMath.mul(liquidity, sqrtLowerTickPrice);
    const bo = MMath.div(liquidity, sqrtUpperTickPrice);

    const sqrtPrice = MMath.sqrt(MMath.div(reserveA + qo, reserveB + bo));
    return [sqrtPrice, liquidity];
  }

  tickPrice(tickSpacing: bigint, _tick: bigint): bigint {
    let tick: bigint = _tick < 0n ? -_tick : _tick;
    tick *= tickSpacing;
    _require(tick <= MAX_TICK, 'OB');

    let ratio: bigint =
      (tick & 0x1n) != 0n
        ? 0xfffcb933bd6fad9d3af5f0b9f25db4d6n
        : 0x100000000000000000000000000000000n;
    if ((tick & 0x2n) != 0n)
      ratio = (ratio * 0xfff97272373d41fd789c8cb37ffcaa1cn) >> 128n;
    if ((tick & 0x4n) != 0n)
      ratio = (ratio * 0xfff2e50f5f656ac9229c67059486f389n) >> 128n;
    if ((tick & 0x8n) != 0n)
      ratio = (ratio * 0xffe5caca7e10e81259b3cddc7a064941n) >> 128n;
    if ((tick & 0x10n) != 0n)
      ratio = (ratio * 0xffcb9843d60f67b19e8887e0bd251eb7n) >> 128n;
    if ((tick & 0x20n) != 0n)
      ratio = (ratio * 0xff973b41fa98cd2e57b660be99eb2c4an) >> 128n;
    if ((tick & 0x40n) != 0n)
      ratio = (ratio * 0xff2ea16466c9838804e327cb417cafcbn) >> 128n;
    if ((tick & 0x80n) != 0n)
      ratio = (ratio * 0xfe5dee046a99d51e2cc356c2f617dbe0n) >> 128n;
    if ((tick & 0x100n) != 0n)
      ratio = (ratio * 0xfcbe86c7900aecf64236ab31f1f9dcb5n) >> 128n;
    if ((tick & 0x200n) != 0n)
      ratio = (ratio * 0xf987a7253ac4d9194200696907cf2e37n) >> 128n;
    if ((tick & 0x400n) != 0n)
      ratio = (ratio * 0xf3392b0822b88206f8abe8a3b44dd9ben) >> 128n;
    if ((tick & 0x800n) != 0n)
      ratio = (ratio * 0xe7159475a2c578ef4f1d17b2b235d480n) >> 128n;
    if ((tick & 0x1000n) != 0n)
      ratio = (ratio * 0xd097f3bdfd254ee83bdd3f248e7e785en) >> 128n;
    if ((tick & 0x2000n) != 0n)
      ratio = (ratio * 0xa9f746462d8f7dd10e744d913d033333n) >> 128n;
    if ((tick & 0x4000n) != 0n)
      ratio = (ratio * 0x70d869a156ddd32a39e257bc3f50aa9bn) >> 128n;
    if ((tick & 0x8000n) != 0n)
      ratio = (ratio * 0x31be135f97da6e09a19dc367e3b6da40n) >> 128n;
    if ((tick & 0x10000n) != 0n)
      ratio = (ratio * 0x9aa508b5b7e5a9780b0cc4e25d61a56n) >> 128n;
    if ((tick & 0x20000n) != 0n)
      ratio = (ratio * 0x5d6af8dedbcb3a6ccb7ce618d14225n) >> 128n;
    if ((tick & 0x40000n) != 0n)
      ratio = (ratio * 0x2216e584f630389b2052b8db590en) >> 128n;
    if ((tick & 0x80000n) != 0n)
      ratio = (ratio * 0x48a1703920644d4030024fen) >> 128n;
    if ((tick & 0x100000n) != 0n) ratio = (ratio * 0x149b34ee7b4532n) >> 128n;
    if (_tick > 0n) ratio = BigInt(2 ** 256 - 1) / ratio;
    return (ratio * BigInt(1e18)) >> 128n;
  }
}
