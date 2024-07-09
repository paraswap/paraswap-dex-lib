import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Log, Logger } from '../../types';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { PoolState } from './types';
import { getOnChainRatio } from './utils';
import { BI_POWS } from '../../bigint-constants';

export class InceptionPool extends StatefulEventSubscriber<PoolState> {
  logDecoder: (log: Log) => any;

  constructor(
    readonly parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    protected vault: string,
    protected inceptionIface: Interface,
  ) {
    super(parentName, 'inception_pool', dexHelper, logger);

    this.logDecoder = (log: Log) => this.inceptionIface.parseLog(log);
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
      this.vault,
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
