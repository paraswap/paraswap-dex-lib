import { Logger } from 'log4js';
import { ICurveV1PriceHandler, ImplementationNames, PoolState } from '../types';
import { FactoryMetaPools } from './factory-meta-pools';
import { IPoolContext } from './types';

const implementations: Record<ImplementationNames, ICurveV1PriceHandler> = {
  [ImplementationNames.FACTORY_META_3POOL_2_15]: FactoryMetaPools.ThreePool2_15,
};

export class PriceHandler {
  readonly priceHandler: IPoolContext;

  constructor(
    readonly logger: Logger,
    readonly implementationName: ImplementationNames,
  ) {
    this.priceHandler = implementations[implementationName];
  }

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
          ? this.priceHandler.get_dy_underlying(state, i, j, amount)
          : this.priceHandler.get_dy(state, i, j, amount);
      }
    });
  }
}
