import { Logger } from 'log4js';
import { ImplementationNames, PoolState } from '../types';
import { IPoolContext } from './types';
import _calc_withdraw_one_coin_Implementations from './functions/_calc_withdraw_one_coin';
import _rates_Implementations from './functions/_rates';
import _xp_mem_Implementations from './functions/_xp_mem';
import _xp_Implementations from './functions/_xp';
import calc_token_amount_Implementations from './functions/calc_token_amount';
import calc_withdraw_one_coin_Implementations from './functions/calc_withdraw_one_coin';
import get_D_mem_Implementations from './functions/get_D_mem';
import get_D_Implementations from './functions/get_D';
import get_dy_underlying_Implementations from './functions/get_dy_underlying';
import get_dy_Implementations from './functions/get_dy';
import get_y_D_Implementations from './functions/get_y_D';
import get_y_Implementations from './functions/get_y';
import constants_Implementations from './functions/constants';

export class PriceHandler {
  readonly priceHandler: IPoolContext;

  static getPriceHandlerFromImplementationName(
    implementationName: ImplementationNames,
    baseImplementationName?: ImplementationNames,
  ): IPoolContext {
    const constants = constants_Implementations[implementationName];
    let _basePool: IPoolContext | undefined;
    if (baseImplementationName !== undefined) {
      _basePool = PriceHandler.getPriceHandlerFromImplementationName(
        baseImplementationName,
      );
    }

    return {
      _calc_withdraw_one_coin:
        _calc_withdraw_one_coin_Implementations[implementationName],
      _rates: _rates_Implementations[implementationName],
      _xp_mem: _xp_mem_Implementations[implementationName],
      _xp: _xp_Implementations[implementationName],
      calc_token_amount: calc_token_amount_Implementations[implementationName],
      calc_withdraw_one_coin:
        calc_withdraw_one_coin_Implementations[implementationName],
      get_D_mem: get_D_mem_Implementations[implementationName],
      get_D: get_D_Implementations[implementationName],
      get_dy_underlying: get_dy_underlying_Implementations[implementationName],
      get_dy: get_dy_Implementations[implementationName],
      get_y_D: get_y_D_Implementations[implementationName],
      get_y: get_y_Implementations[implementationName],

      constants,

      _basePool,
      IMPLEMENTATION_NAME: implementationName,
    };
  }

  constructor(
    readonly logger: Logger,
    readonly implementationName: ImplementationNames,
    readonly baseImplementationName?: ImplementationNames,
  ) {
    this.priceHandler = PriceHandler.getPriceHandlerFromImplementationName(
      implementationName,
      baseImplementationName,
    );
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
          ? this.priceHandler.get_dy_underlying(
              this.priceHandler,
              state,
              i,
              j,
              amount,
            )
          : this.priceHandler.get_dy(this.priceHandler, state, i, j, amount);
      }
    });
  }
}
