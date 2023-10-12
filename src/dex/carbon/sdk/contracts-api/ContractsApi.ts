import { Provider } from '@ethersproject/providers';
import { ContractsConfig } from './types';
import Composer from './Composer';
import Contracts from './Contracts';
import Reader from './Reader';

/**
 * Class that handles the interaction with contracts through a provider.
 */
export class ContractsApi {
  private _reader: Reader;
  private _composer: Composer;

  public constructor(provider: Provider, config?: ContractsConfig) {
    const contracts = new Contracts(provider, config);
    this._reader = new Reader(contracts);
    this._composer = new Composer(contracts);
  }

  public get reader(): Reader {
    return this._reader;
  }

  public get composer(): Composer {
    return this._composer;
  }
}
