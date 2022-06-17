import { BI_POWS } from '../../../bigint-constants';

export class Const {
  static ONE = BI_POWS[18];

  static MIN_POW_BASE = 1n;
  static MAX_POW_BASE = 2n * this.ONE - 1n;

  static POW_PRECISION = this.ONE / 10n ** 10n;

  static ORACLE_TIMEOUT = 2n * 60n;

  static MIN_FEE = this.ONE / 10n ** 6n;
  static EXIT_FEE = 0n;

  static BASE_Z = 6n * this.ONE;
  static BASE_HORIZON = 5n * this.ONE;

  static BASE_LOOKBACK_IN_ROUND = 5;
  static BASE_LOOKBACK_IN_SEC = 3600n;
  static LOOKBACK_STEP_IN_ROUND = 4;

  static MAX_IN_RATIO = this.ONE / 2n;
  static MAX_OUT_RATIO = this.ONE / 3n + 1n;

  static FALLBACK_SPREAD = (3n * this.ONE) / 1000n;

  static BASE_MAX_PRICE_UNPEG_RATIO = this.ONE + this.ONE / 40n;
}
