import VaultABI from '../../abi/inception/inception-vault.json';

import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Log, Logger } from '../../types';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { DexParams, PoolState } from './types';
import { getOnChainRatio } from './utils';
import { BI_POWS } from '../../bigint-constants';

export class InceptionPool extends StatefulEventSubscriber<PoolState> {
  logDecoder: (log: Log) => any;

  addressesSubscribed: string[];

  constructor(
    readonly parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    protected config: DexParams,
    protected inceptionIface = new Interface(VaultABI),
  ) {
    super(parentName, 'inception_pool', dexHelper, logger);

    this.logDecoder = (log: Log) => this.inceptionIface.parseLog(log);
    this.addressesSubscribed = [this.config.vault];
  }

  protected processLog(
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    return state;
  }

  async generateState(blockNumber: number): Promise<DeepReadonly<PoolState>> {
    const state = await getOnChainRatio(
      this.dexHelper.multiContract,
      this.config.vault,
      this.inceptionIface,
      blockNumber,
    );

    return state;
  }

  getPrice(blockNumber: number, ethAmount: bigint): bigint {
    const state = this.getState(blockNumber);
    if (!state) throw new Error('Cannot compute price');

    return (ethAmount * state.ratio) / BI_POWS[18];
  }
}
