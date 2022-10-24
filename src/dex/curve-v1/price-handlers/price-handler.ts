import _ from 'lodash';
import { Logger } from 'log4js';
import { funcName, _require } from '../../../utils';
import { PoolState } from '../types';
import { get_D } from './functions/get_D';
import { get_dy } from './functions/get_dy';
import { get_dy_underlying } from './functions/get_dy_underlying';
import { get_y } from './functions/get_y';
import { _A } from './functions/_A';

export type GeneralDependantFuncs = {
  get_dy: get_dy;
  get_dy_underlying?: get_dy_underlying;

  _A: _A;
  get_y: get_y;
  get_D: get_D;
};

export class PriceHandler {
  funcs: GeneralDependantFuncs;

  constructor(readonly name: string, readonly logger: Logger) {}

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
        if (isUnderlying && this.funcs.get_dy_underlying === undefined) {
          this.logger.error(
            `${
              this.name
            } ${funcName()}: received isUnderlying=${isUnderlying}, but func get_dy_underlying is not set`,
          );
          return 0n;
        }
        return isUnderlying
          ? this.funcs.get_dy_underlying!(state, this.funcs, i, j, amount)
          : this.funcs.get_dy(state, this.funcs, i, j, amount);
      }
    });
  }
}
