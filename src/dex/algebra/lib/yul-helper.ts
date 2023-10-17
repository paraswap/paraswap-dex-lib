export class Yul {
  static sub(x: bigint, y: bigint): bigint {
    return x - y;
  }

  static sdiv(x: bigint, y: bigint): bigint {
    return y === 0n ? 0n : x / y;
  }

  static and(x: bigint, y: bigint): bigint {
    return x & y;
  }

  static slt(x: bigint, y: bigint): bigint {
    return x < y ? 1n : 0n;
  }

  static not(x: bigint): bigint {
    return ~x;
  }

  static iszero(x: bigint): bigint {
    return x === 0n ? 1n : 0n;
  }

  static smod(x: bigint, y: bigint): bigint {
    return y === 0n ? 0n : x % y;
  }
}
