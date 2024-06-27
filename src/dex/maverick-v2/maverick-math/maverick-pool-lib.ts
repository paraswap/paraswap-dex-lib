import { Bin, Tick } from '../types';
import { MaverickBasicMath } from './maverick-basic-math';

export class MaverickPoolLib {
  static binReserves(bin: Bin, tick: Tick): [bigint, bigint] {
    return this.binReservesCalc(
      bin.tickBalance,
      tick.reserveA,
      tick.reserveB,
      tick.totalSupply,
    );
  }

  static binReservesCalc(
    tickBalance: bigint,
    tickReserveA: bigint,
    tickReserveB: bigint,
    tickTotalSupply: bigint,
  ): [bigint, bigint] {
    let reserveA = 0n;
    let reserveB = 0n;

    if (tickTotalSupply != 0n) {
      reserveA = this.reserveValue(tickReserveA, tickBalance, tickTotalSupply);
      reserveB = this.reserveValue(tickReserveB, tickBalance, tickTotalSupply);
    }
    return [reserveA, reserveB];
  }

  static reserveValue(
    tickReserve: bigint,
    tickBalance: bigint,
    tickTotalSupply: bigint,
  ): bigint {
    let reserve = MaverickBasicMath.mulDivFloor(
      tickReserve,
      tickBalance,
      tickTotalSupply,
    );
    return MaverickBasicMath.min(tickReserve, reserve);
  }
}
