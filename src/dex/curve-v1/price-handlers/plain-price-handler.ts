import { PoolState } from '../types';
import { BasePriceHandler } from './base-price-handler';
import { IPriceHandler } from './iprice-handler';

class PlainPriceHandler
  extends BasePriceHandler
  implements IPriceHandler<PoolState>
{
  getOutputs(
    state: PoolState,
    amounts: bigint[],
    i: number,
    j: number,
    isUnderlying: boolean,
  ): bigint[] {
    return amounts.map(amount => {
      if (amount === 0n) {
        return 0n;
      } else {
        return isUnderlying
          ? this.get_dy_underlying(state, i, j, amount)
          : this.get_dy(state, i, j, amount);
      }
    });
  }
}

export const plainPriceHandler = new PlainPriceHandler();
