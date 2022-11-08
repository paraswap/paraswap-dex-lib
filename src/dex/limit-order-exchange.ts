import Web3 from 'web3';
import { LIMIT_ORDER_PROVIDERS } from '../constants';
import { IDexHelper } from '../dex-helper';
import { ILimitOrderProvider } from '../dex-helper/ilimit-order-provider';
import { Address } from '../types';
import { SimpleExchange } from './simple-exchange';

export abstract class LimitOrderExchange<
  LimitOrderResponse,
  LimitOrderPriceSummaryResponse,
> extends SimpleExchange {
  protected _limitOrderProvider?: ILimitOrderProvider<
    LimitOrderResponse,
    LimitOrderPriceSummaryResponse
  >;

  constructor(dexHelper: IDexHelper, name: string) {
    super(dexHelper, name);
  }

  abstract get limitOrderProviderName(): LIMIT_ORDER_PROVIDERS;

  set limitOrderProvider(
    limitOrderProvider: ILimitOrderProvider<
      LimitOrderResponse,
      LimitOrderPriceSummaryResponse
    >,
  ) {
    if (
      this.limitOrderProviderName.toLowerCase() ===
      limitOrderProvider.name.toLowerCase()
    ) {
      this._limitOrderProvider = limitOrderProvider;
    } else {
      throw new Error(
        `Given wrong limitOrderProvider: '${limitOrderProvider.name}'. Expected: '${this.limitOrderProviderName}'`,
      );
    }
  }
}
