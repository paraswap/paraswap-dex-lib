import { DeepReadonly } from 'ts-essentials';
import { Logger, MultiCallInput } from '../../types';
import { ComposedEventSubscriber } from '../../composed-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { lens } from '../../lens';
import { ChainLinkProxy, PoolConfig, PoolState, PriceFeed } from './types';

import { Interface } from '@ethersproject/abi';
import { SynthereumPoolEvent } from './syntheteumPool-event';
import { Contract } from 'web3-eth-contract';
import { ChainLinkSubscriber } from '../../lib/chainlink';
import { Address } from '@paraswap/core';
import { calculateConvertedPrice, PRICE_UNIT } from './utils';
export class JarvisV6EventPool extends ComposedEventSubscriber<PoolState> {
  constructor(
    parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    public poolConfig: PoolConfig,
    public poolInterface: Interface,
  ) {
    const poolEvent = new SynthereumPoolEvent(
      poolConfig.address,
      poolInterface,
      lens<DeepReadonly<PoolState>>().pool,
      logger,
    );

    const chainLinksEvents = poolConfig.priceFeed
      .map(p => {
        return new ChainLinkSubscriber<PoolState>(
          p.proxy,
          p.aggregator,
          lens<DeepReadonly<PoolState>>().chainlink[p.pair],
          dexHelper.getLogger(
            `${p.pair} ChainLink for ${parentName}-${network} at address: ${p.aggregator}`,
          ),
        );
      })
      .flat();

    super(
      parentName,
      'pool',
      logger,
      dexHelper,
      [poolEvent, ...chainLinksEvents],
      {
        chainlink: {},
        pool: { feesPercentage: 0n },
      },
    );
  }

  static async getConfig(
    poolConfigs: PoolConfig[],
    chainLinkProxies: ChainLinkProxy,
    blockNumber: number | 'latest',
    multiContract: Contract,
  ): Promise<PoolConfig[]> {
    let multiCallData: MultiCallInput[] = Object.values(chainLinkProxies).map(
      proxyAddress =>
        ChainLinkSubscriber.getReadAggregatorMultiCallInput(proxyAddress),
    );

    const callData = (
      await multiContract.methods.aggregate(multiCallData).call({}, blockNumber)
    ).returnData;

    const chainlink: {
      [pair: string]: { proxy: Address; aggregator: Address };
    } = {};
    Object.entries(chainLinkProxies).forEach(([key, value], index) => {
      const aggregator = ChainLinkSubscriber.readAggregator(callData[index]);

      chainlink[key] = {
        proxy: value,
        aggregator,
      };
    });
    return poolConfigs.map(config => {
      const priceFeed = config.priceFeed.map(p => {
        return {
          ...p,
          aggregator: chainlink[p.pair].aggregator,
          proxy: chainlink[p.pair].proxy,
        };
      });
      return { ...config, priceFeed };
    });
  }

  getIdentifier(): string {
    return `${this.parentName}_${this.poolConfig.address}`.toLowerCase();
  }

  async getPairPrice(blockNumber: number) {
    const state = await this.getStateOrGenerate(blockNumber);
    return this.poolConfig.priceFeed.reduce((acc: bigint, cur) => {
      return (
        (acc *
          calculateConvertedPrice(
            state.chainlink[cur.pair].answer,
            cur.isReversePrice,
          )) /
        PRICE_UNIT
      );
    }, PRICE_UNIT);
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
  async getStateOrGenerate(blockNumber: number): Promise<Readonly<PoolState>> {
    const evenState = this.getState(blockNumber);
    if (evenState) return evenState;
    const onChainState = await this.generateState(blockNumber);
    this.setState(onChainState, blockNumber);
    return onChainState;
  }
}
