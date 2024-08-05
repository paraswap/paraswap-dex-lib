import { DeepReadonly } from 'ts-essentials';
import { Logger } from '../../types';
import { ComposedEventSubscriber } from '../../composed-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { lens } from '../../lens';
import { PoolConfig, PoolState } from './types';
import { getOnChainState } from './utils';
import { Interface, JsonFragment } from '@ethersproject/abi';
import { InceptionPriceFeed } from './inception-price-feed';

export class InceptionEventPool extends ComposedEventSubscriber<PoolState> {
  constructor(
    parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    public poolConfig: PoolConfig,
    public poolInterface: Interface,
  ) {
    const ratioFeedEvent = new InceptionPriceFeed(
      poolConfig.ratioFeedAddress,
      network,
      lens<DeepReadonly<PoolState>>(),
      logger,
    );
    super(
      parentName,
      'pool',
      logger,
      dexHelper,
      [ratioFeedEvent],
      poolConfig.initState,
    );
  }

  getIdentifier(): string {
    return `${this.parentName}_${this.poolConfig.ratioFeedAddress}`.toLowerCase();
  }

  /**
   * The function generates state using on-chain calls. This
   * function is called to regenerate state if the event based
   * system fails to fetch events and the local state is no
   * more correct.
   * @param blockNumber - Blocknumber for which the state should
   * should be generated
   * @returns state of the event subscriber at blocknumber
   */
  async generateState(blockNumber: number): Promise<Readonly<PoolState>> {
    return getOnChainState(
      this.dexHelper.multiContract,
      this.poolInterface,
      this.network,
      blockNumber,
    );
  }
}
