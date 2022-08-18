import { DeepReadonly } from 'ts-essentials';
import { Logger } from '../../types';
import { ComposedEventSubscriber } from '../../composed-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { lens } from '../../lens';
import { PoolConfig, PoolState, priceFeedData } from './types';
import { getOnChainState } from './utils';
import { Interface } from '@ethersproject/abi';
import { ChainLinkPriceFeed } from './chainLinkpriceFeed-event';
import { SynthereumPoolEvent } from './syntheteumPool-event';

export class JarvisV6EventPool extends ComposedEventSubscriber<PoolState> {
  constructor(
    protected parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    public poolConfig: PoolConfig,
    public priceFeed: priceFeedData,
    public poolInterface: Interface,
  ) {
    const chainLinkEvent = new ChainLinkPriceFeed(
      poolConfig.chainLink.address,
      poolConfig.chainLink.interface,
      lens<DeepReadonly<PoolState>>().priceFeed,
      logger,
    );

    const poolEvent = new SynthereumPoolEvent(
      poolConfig.address,
      poolInterface,
      lens<DeepReadonly<PoolState>>().pool,
      logger,
    );
    super(parentName, logger, dexHelper, [chainLinkEvent, poolEvent], {
      priceFeed: {
        usdcPrice: 0n,
      },
      pool: {
        feesPercentage: 0n,
      },
    });
  }

  getIdentifier(): string {
    return `${this.parentName}_${this.poolConfig.address}`.toLowerCase();
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
    return (
      await getOnChainState(
        this.dexHelper,
        this.priceFeed.address,
        [this.poolConfig],
        this.poolInterface,
        blockNumber,
      )
    )[0];
  }
}
