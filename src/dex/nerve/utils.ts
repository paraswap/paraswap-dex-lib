export const biginterify = (val: any) => BigInt(val);

export const stringify = (val: any) => val.toString();

export const ZERO = biginterify(0);

export const ONE = biginterify(1);

export class MathUtil {
  static within1(a: bigint, b: bigint) {
    return MathUtil.difference(a, b) <= ONE;
  }

  static difference(a: bigint, b: bigint) {
    if (a > b) {
      return a - b;
    }
    return b - a;
  }
}
