import { BasePriceHandler } from './base-price-handler';

export class FactoryPlain extends BasePriceHandler {
  protected get_dy(state: PoolState, i: number, j: number, dx: bigint) {
    const { rate_multipliers, PRECISION, FEE_DENOMINATOR } = state.constants;
    const xp = this._xp(state);

    const x = xp[i] + (dx * rate_multipliers[i]) / PRECISION;
    const y = this.get_y(state, i, j, x, xp);
    const dy = ((xp[j] - y - 1n) * PRECISION) / rate_multipliers[j];
    const _fee = (state.fee * dy) / FEE_DENOMINATOR;
    return dy - _fee;
  }

  protected get_dy_underlying(
    state: PoolState,
    i: number,
    j: number,
    dx: bigint,
  ) {
    const { PRECISION: PRECISION_MUL, FEE_DENOMINATOR } = state.constants;
    const xp = this._xp(state);

    const x = xp[i] + dx * PRECISION_MUL[i];
    const y = this.get_y(state, i, j, x, xp);
    const dy = (xp[j] - y - 1n) / PRECISION_MUL[j];
    const _fee = (state.fee * dy) / FEE_DENOMINATOR;
    return dy - _fee;
  }
}
