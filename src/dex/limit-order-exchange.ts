import { Provider } from '@ethersproject/providers';
import { LIMIT_ORDER_PROVIDERS } from '../constants';
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

  constructor(augustusAddress: Address, provider: Provider) {
    super(augustusAddress, provider);
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
