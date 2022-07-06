export class UnsafeMath {
  static divRoundingUp(x: bigint, y: bigint) {
    return (x + y - 1n) / y;
  }
}
