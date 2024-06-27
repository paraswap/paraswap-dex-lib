export class MaverickMath {
  static ammScaleToTokenScale(
    amount: bigint,
    scaleFactor: bigint,
    ceil: boolean,
  ): bigint {
    if (scaleFactor === 1n || amount === 0n) {
      return amount;
    } else {
      if (!ceil) return amount / scaleFactor;
      return (amount - 1n) / scaleFactor + 1n;
    }
  }

  static tokenScaleToAmmScale(amount: bigint, scaleFactor: bigint): bigint {
    if (scaleFactor === 1n) {
      return amount;
    } else {
      return amount * scaleFactor;
    }
  }

  static scale(decimals: bigint): bigint {
    if (decimals === 18n) {
      return 1n;
    } else {
      return 10n ** (18n - decimals);
    }
  }
}
