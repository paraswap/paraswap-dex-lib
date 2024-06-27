import { BI_POWS } from '../../../bigint-constants';
import { AddLiquidityInfo, Bin, BinDelta, Tick } from '../types';
import { MaverickBasicMath } from './maverick-basic-math';
import { MaverickPoolLib } from './maverick-pool-lib';
import { MaverickTickMath } from './maverick-tick-math';

const MINIMUM_LIQUIDITY = BI_POWS[8];

export class MaverickBinMath {
  static lpBalancesFromDeltaReserve(
    self: Bin,
    tick: Tick,
    deltaA: bigint,
    deltaB: bigint,
  ): bigint {
    if (tick.reserveA >= tick.reserveB) {
      let reserveA = MaverickBasicMath.mulDivUp(
        tick.reserveA,
        self.tickBalance,
        tick.totalSupply,
      );
      return MaverickBasicMath.mulDivDown(
        deltaA,
        MaverickBasicMath.max(1n, self.totalSupply),
        reserveA,
      );
    } else {
      let reserveB = MaverickBasicMath.mulDivUp(
        tick.reserveB,
        self.tickBalance,
        tick.totalSupply,
      );
      return MaverickBasicMath.mulDivDown(
        deltaB,
        MaverickBasicMath.max(1n, self.totalSupply),
        reserveB,
      );
    }
  }

  static addLiquidity(
    self: Bin,
    tick: Tick,
    deltaLpBalance: bigint,
    addLiquidityInfo: AddLiquidityInfo,
  ) {
    let deltaTickBalance = this.deltaTickBalanceFromDeltaLpBalance(
      self.tickBalance,
      self.totalSupply,
      tick,
      deltaLpBalance,
      addLiquidityInfo,
    );

    this.updateBinState(
      self,
      tick,
      addLiquidityInfo.deltaA,
      addLiquidityInfo.deltaB,
      deltaLpBalance,
      deltaTickBalance,
    );
  }

  static setRequiredDeltaReservesForEmptyTick(
    deltaLpBalance: bigint,
    addLiquidityInfo: AddLiquidityInfo,
  ) {
    let [sqrtLowerTickPrice, sqrtUpperTickPrice] =
      MaverickTickMath.tickSqrtPrices(
        addLiquidityInfo.tickSpacing,
        addLiquidityInfo.tick,
      );
    addLiquidityInfo.deltaA = addLiquidityInfo.tickLtActive
      ? MaverickBasicMath.mulCeil(deltaLpBalance, sqrtLowerTickPrice)
      : 0n;
    addLiquidityInfo.deltaB = addLiquidityInfo.tickLtActive
      ? 0n
      : MaverickBasicMath.divCeil(deltaLpBalance, sqrtUpperTickPrice);
  }

  static deltaTickBalanceFromDeltaLpBalance(
    binTickBalance: bigint,
    binTotalSupply: bigint,
    tick: Tick,
    deltaLpBalance: bigint,
    addLiquidityInfo: AddLiquidityInfo,
  ): bigint {
    let numerator = MaverickBasicMath.max(1n, binTickBalance) * deltaLpBalance;
    let denominator =
      MaverickBasicMath.max(1n, tick.totalSupply) *
      MaverickBasicMath.max(1n, binTotalSupply);
    if (tick.reserveA != 0n || tick.reserveB != 0n) {
      addLiquidityInfo.deltaA = MaverickBasicMath.mulDivCeil(
        tick.reserveA,
        numerator,
        denominator,
      );
      addLiquidityInfo.deltaB = MaverickBasicMath.mulDivCeil(
        tick.reserveB,
        numerator,
        denominator,
      );
    } else {
      this.setRequiredDeltaReservesForEmptyTick(
        deltaLpBalance,
        addLiquidityInfo,
      );
    }

    return tick.totalSupply === 0n
      ? deltaLpBalance
      : MaverickBasicMath.mulDivDown(
          deltaLpBalance,
          MaverickBasicMath.max(1n, binTickBalance),
          binTotalSupply,
        );
  }

  static addLiquidityByReserves(
    self: Bin,
    tick: Tick,
    deltaA: bigint,
    deltaB: bigint,
    deltaLpBalance: bigint,
  ) {
    let deltaTickBalance = MaverickBasicMath.mulDivDown(
      deltaLpBalance,
      MaverickBasicMath.max(1n, self.tickBalance),
      self.totalSupply,
    );

    this.updateBinState(
      self,
      tick,
      deltaA,
      deltaB,
      deltaLpBalance,
      deltaTickBalance,
    );
  }

  static updateBinState(
    self: Bin,
    tick: Tick,
    deltaA: bigint,
    deltaB: bigint,
    deltaLpBalance: bigint,
    deltaTickBalance: bigint,
  ) {
    let totalSupply = self.totalSupply;
    if (totalSupply === 0n) {
      if (deltaLpBalance < MINIMUM_LIQUIDITY) {
        throw 'insufficient liquidity';
      }
      totalSupply = MINIMUM_LIQUIDITY;
    }

    self.totalSupply = totalSupply + deltaLpBalance;
    tick.totalSupply = tick.totalSupply + deltaTickBalance;

    self.tickBalance = self.tickBalance + deltaTickBalance;

    tick.reserveA = tick.reserveA + deltaA;
    tick.reserveB = tick.reserveB + deltaB;
  }

  static removeLiquidity(
    self: Bin,
    ticks: { [id: string]: Tick },
    bins: { [id: string]: Bin },
    deltaLpAmount: bigint,
  ): [bigint, bigint] {
    let activeBin = self;

    let activeBinDeltaLpBalance = deltaLpAmount;
    if (self.mergeId != 0n) {
      activeBin = bins[self.mergeId.toString()];

      if (activeBin.mergeId != 0n) {
        throw 'migrate first';
      }

      let tempTotalSupply = self.totalSupply;
      self.totalSupply = MaverickBasicMath.clip(
        self.totalSupply,
        deltaLpAmount,
      );

      activeBinDeltaLpBalance = MaverickBasicMath.min(
        self.mergeBinBalance,
        MaverickBasicMath.mulDivDown(
          activeBinDeltaLpBalance,
          self.mergeBinBalance,
          tempTotalSupply,
        ),
      );

      self.mergeBinBalance -= activeBinDeltaLpBalance;
    }

    let binDelta: BinDelta = {
      deltaA: 0n,
      deltaB: 0n,
    };

    let tick: Tick = ticks[activeBin.tick.toString()];

    activeBinDeltaLpBalance = MaverickBasicMath.min(
      activeBinDeltaLpBalance,
      activeBin.totalSupply,
    );

    let deltaTickBalance = MaverickBasicMath.mulDivDown(
      activeBinDeltaLpBalance,
      activeBin.tickBalance,
      activeBin.totalSupply,
    );

    deltaTickBalance = MaverickBasicMath.min(
      deltaTickBalance,
      tick.totalSupply,
    );

    [binDelta.deltaA, binDelta.deltaB] = MaverickPoolLib.binReservesCalc(
      deltaTickBalance,
      tick.reserveA,
      tick.reserveB,
      tick.totalSupply,
    );

    tick.reserveA = MaverickBasicMath.clip(tick.reserveA, binDelta.deltaA);
    tick.reserveB = MaverickBasicMath.clip(tick.reserveB, binDelta.deltaB);

    activeBin.tickBalance = MaverickBasicMath.clip(
      activeBin.tickBalance,
      deltaTickBalance,
    );
    tick.totalSupply = MaverickBasicMath.clip(
      tick.totalSupply,
      deltaTickBalance,
    );
    activeBin.totalSupply = MaverickBasicMath.clip(
      activeBin.totalSupply,
      activeBinDeltaLpBalance,
    );

    return [binDelta.deltaA, binDelta.deltaB];
  }

  static migrateBinsUpStack(
    self: Bin,
    bins: { [id: string]: Bin },
    maxRecursion: bigint,
  ): void {
    if (self.mergeId === 0n) return;

    let nextBin = bins[self.mergeId.toString()];

    if (nextBin.mergeId === 0n) return;

    self.mergeId = nextBin.mergeId;

    let tempTotalSupply = nextBin.totalSupply;
    let tempMergeBinBalance = self.mergeBinBalance;

    nextBin.totalSupply = MaverickBasicMath.clip(
      nextBin.totalSupply,
      self.mergeBinBalance,
    );

    self.mergeBinBalance = MaverickBasicMath.mulDiv(
      tempMergeBinBalance,
      nextBin.mergeBinBalance,
      tempTotalSupply,
    );

    nextBin.mergeBinBalance = MaverickBasicMath.clip(
      nextBin.mergeBinBalance,
      self.mergeBinBalance,
    );

    maxRecursion -= 1n;
    if (maxRecursion != 0n) {
      return this.migrateBinsUpStack(self, bins, maxRecursion);
    }
  }
}
