import { BI_POWS } from '../../../bigint-constants';

const decimals = 18;

const UNIT = BI_POWS[decimals];

export class SafeDecimalMath {
  static get unit(): bigint {
    return UNIT;
  }

  static multiplyDecimal(x: bigint, y: bigint): bigint {
    /* Divide by UNIT to remove the extra factor introduced by the product. */
    return (x * y) / UNIT;
  }

  static divideDecimalRound(x: bigint, y: bigint): bigint {
    return SafeDecimalMath._divideDecimalRound(x, y, UNIT);
  }

  static _divideDecimalRound(x: bigint, y: bigint, precisionUnit: bigint) {
    let resultTimesTen = (x * (precisionUnit * 10n)) / y;

    if (resultTimesTen % 10n >= 5n) {
      resultTimesTen += 10n;
    }

    return resultTimesTen / 10n;
  }

  static multiplyDecimalRound(x: bigint, y: bigint): bigint {
    return SafeDecimalMath._multiplyDecimalRound(x, y, UNIT);
  }

  static _multiplyDecimalRound(x: bigint, y: bigint, precisionUnit: bigint) {
    let quotientTimesTen = (x * y) / (precisionUnit / 10n);

    if (quotientTimesTen % 10n >= 5n) {
      quotientTimesTen += 10n;
    }

    return quotientTimesTen / 10n;
  }
}
