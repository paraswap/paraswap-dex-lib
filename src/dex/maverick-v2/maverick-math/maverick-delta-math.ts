export type Delta = {
  deltaInBinInternal: bigint;
  deltaInErc: bigint;
  deltaOutErc: bigint;
  excess: bigint;
  tokenAIn: boolean;
  exactOutput: boolean;
  swappedToMaxPrice: boolean;
  skipCombine: boolean;
  tickLimit: bigint;
  sqrtLowerTickPrice: bigint;
  sqrtUpperTickPrice: bigint;
  sqrtPrice: bigint;
  fractionalPart: bigint;
};

export class MaverickDeltaMath {
  static pastMaxTick(self: Delta, activeTick: bigint) {
    self.swappedToMaxPrice = self.tokenAIn
      ? self.tickLimit < activeTick
      : self.tickLimit > activeTick;
    if (self.swappedToMaxPrice) {
      self.excess = 0n;
      self.skipCombine = true;
    }
    return self.swappedToMaxPrice;
  }

  static sqrtEdgePrice(self: Delta) {
    return self.tokenAIn ? self.sqrtUpperTickPrice : self.sqrtLowerTickPrice;
  }
}
