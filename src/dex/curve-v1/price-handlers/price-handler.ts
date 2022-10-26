import _ from 'lodash';
import { Logger } from 'log4js';
import { funcName, _require } from '../../../utils';
import { ImplementationNames, PoolState } from '../types';
import get_DImplementations, { get_D } from './functions/get_D';
import get_dyImplementations, { get_dy } from './functions/get_dy';
import get_dy_underlyingImplementations, {
  get_dy_underlying,
} from './functions/get_dy_underlying';
import get_yImplementations, { get_y } from './functions/get_y';
import _AImplementations, { _A } from './functions/_A';
import _xp_memImplementations, { _xp_mem } from './functions/_xp_mem';

type GeneralDependantFuncs = {
  _xp_mem: _xp_mem;
  get_dy: get_dy;
  get_dy_underlying: get_dy_underlying;

  _A: _A;
  get_y: get_y;
  get_D: get_D;
};

type GeneralBaseDependantFuncs = {};

export class PriceHandler {
  funcs: GeneralDependantFuncs;
  baseFuncs?: GeneralBaseDependantFuncs;

  constructor(
    readonly name: string,
    readonly logger: Logger,
    readonly implementationName: ImplementationNames,
    readonly baseImplementationName?: ImplementationNames,
  ) {
    this.funcs = {
      _xp_mem: _xp_memImplementations[implementationName],
      get_dy: get_dyImplementations[implementationName],
      get_dy_underlying: get_dy_underlyingImplementations[implementationName],
      _A: _AImplementations[implementationName],
      get_y: get_yImplementations[implementationName],
      get_D: get_DImplementations[implementationName],
    };
    if (baseImplementationName) {
      this.baseFuncs = {};
    }
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
        if (
          isUnderlying &&
          (this.baseImplementationName === undefined ||
            this.baseFuncs === undefined ||
            state.basePoolState === undefined)
        ) {
          this.logger.error(
            `${
              this.name
            } ${funcName()}: received exchange underlying, but instance is not initialized properly`,
          );
          return 0n;
        } else if (
          this.baseImplementationName &&
          state.basePoolState === undefined
        ) {
          this.logger.error(
            `${
              this.name
            } ${funcName()}: received exchange in meta pool without setting virtual price. Check configs`,
          );
          return 0n;
        }
        return isUnderlying
          ? this.funcs.get_dy_underlying(
              state,
              state.basePoolState!,
              this.funcs,
              this.baseFuncs!,
              i,
              j,
              amount,
            )
          : this.funcs.get_dy(
              state,
              this.funcs,
              i,
              j,
              amount,
              state.basePoolState?.virtualPrice,
            );
      }
    });
  }
}
