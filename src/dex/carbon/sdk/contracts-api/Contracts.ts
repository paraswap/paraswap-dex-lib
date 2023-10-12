import {
  CarbonController__factory,
  CarbonController,
  Multicall,
  Multicall__factory,
  Voucher,
  Voucher__factory,
  Token,
  Token__factory,
} from '../abis/types';

import { Provider } from '@ethersproject/providers';
import { config as defaultConfig } from './config';
import { ContractsConfig } from './types';

export default class Contracts {
  private _provider: Provider;
  private _carbonController: CarbonController | undefined;
  private _multiCall: Multicall | undefined;
  private _voucher: Voucher | undefined;
  private _config = defaultConfig;

  public constructor(provider: Provider, config?: ContractsConfig) {
    this._provider = provider;
    this._config.carbonControllerAddress =
      config?.carbonControllerAddress || defaultConfig.carbonControllerAddress;
    this._config.multiCallAddress =
      config?.multiCallAddress || defaultConfig.multiCallAddress;
    this._config.voucherAddress =
      config?.voucherAddress || defaultConfig.voucherAddress;
  }

  public get carbonController(): CarbonController {
    if (!this._carbonController)
      this._carbonController = CarbonController__factory.connect(
        this._config.carbonControllerAddress,
        this._provider,
      );

    return this._carbonController;
  }

  public get multicall(): Multicall {
    if (!this._multiCall)
      this._multiCall = Multicall__factory.connect(
        this._config.multiCallAddress,
        this._provider,
      );

    return this._multiCall;
  }

  public get voucher(): Voucher {
    if (!this._voucher)
      this._voucher = Voucher__factory.connect(
        this._config.voucherAddress,
        this._provider,
      );

    return this._voucher;
  }

  public token(address: string): Token {
    return Token__factory.connect(address, this._provider);
  }

  public get provider(): Provider {
    return this._provider;
  }
}
