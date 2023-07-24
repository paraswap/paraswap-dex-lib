export class QuadMath {
  static getSmallerRootOfQuadEqn(a: bigint, b: bigint, c: bigint): bigint {
    let smallerRoot: bigint = 0n;

    smallerRoot = (b - this.sqrt(b * b - a * c)) / a;
    return smallerRoot;
  }

  static sqrt(y: bigint): bigint {
    let z = 0n;

    if (y > 3) {
      z = y;
      let x = y / 2n + 1n;
      while (x < z) {
        z = x;
        x = (y / x + x) / 2n;
      }
    } else if (y != 0n) {
      z = 1n;
    }

    return z;
  }
}
