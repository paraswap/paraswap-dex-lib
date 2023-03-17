import { DeepReadonly } from 'ts-essentials';
import { Logger, MultiCallInput } from '../../types';
import { ComposedEventSubscriber } from '../../composed-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { lens } from '../../lens';
import { ChainLink, PoolConfig, PoolState } from './types';

import { Interface } from '@ethersproject/abi';
import { SynthereumPoolEvent } from './syntheteumPool-event';
import { Contract } from 'web3-eth-contract';
import { ChainLinkSubscriber } from '../../lib/chainlink';
import { Address } from '@paraswap/core';
import {
  calculateConvertedPrice,
  convertToNewDecimals,
  PRICE_UNIT,
} from './utils';
export class JarvisV6EventPool extends ComposedEventSubscriber<PoolState> {
  constructor(
    parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    public poolConfig: PoolConfig,
    public chainLinkEvents: { [pair: string]: ChainLinkSubscriber<PoolState> },
    public poolInterface: Interface,
  ) {
    const poolEvent = new SynthereumPoolEvent(
      poolConfig.address,
      poolInterface,
      lens<DeepReadonly<PoolState>>().pool,
      logger,
    );

    super(
      parentName,
      'pool',
      logger,
      dexHelper,
      [poolEvent, ...Object.values(chainLinkEvents)],
      {
        chainlink: {},
        pool: { feesPercentage: 0n },
      },
    );
  }

  static async getChainLinkSubscriberMap(
    chainLinkConfigs: ChainLink,
    dexKey: string,
    dexHelper: IDexHelper,
    network: number,
    blockNumber: number | 'latest',
  ): Promise<{ [pair: string]: ChainLinkSubscriber<PoolState> }> {
    const chainLink = await JarvisV6EventPool.getChainLinkConfig(
      chainLinkConfigs,
      blockNumber,
      dexHelper.multiContract,
    );
    return Object.entries(chainLink).reduce(
      (
        acc: { [pair: string]: ChainLinkSubscriber<PoolState> },
        [key, value],
      ) => {
        acc[key] = new ChainLinkSubscriber<PoolState>(
          value.proxy,
          value.aggregator,
          lens<DeepReadonly<PoolState>>().chainlink[key],
          dexHelper.getLogger(
            `${key} ChainLink for ${dexKey}-${network} at address: ${value.aggregator}`,
          ),
        );
        return acc;
      },
      {},
    );
  }

  static async getChainLinkConfig(
    chainLink: ChainLink,
    blockNumber: number | 'latest',
    multiContract: Contract,
  ): Promise<ChainLink> {
    let multiCallData: MultiCallInput[] = Object.values(chainLink).map(
      ({ proxy }) => ChainLinkSubscriber.getReadAggregatorMultiCallInput(proxy),
    );

    const callData = (
      await multiContract.methods.aggregate(multiCallData).call({}, blockNumber)
    ).returnData;

    const chainlink: {
      [pair: string]: { proxy: Address; aggregator: Address };
    } = {};
    Object.entries(chainLink).forEach(([pair, value], index) => {
      const aggregator = ChainLinkSubscriber.readAggregator(callData[index]);
      chainlink[pair] = {
        proxy: value.proxy,
        aggregator,
      };
    });
    return chainlink;
  }

  getIdentifier(): string {
    return `${this.parentName}_${this.poolConfig.address}`.toLowerCase();
  }

  async getPoolPrice(blockNumber: number) {
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

  async getPairPrices(blockNumber: number) {
    const state = await this.getStateOrGenerate(blockNumber);
    return this.poolConfig.priceFeed.reduce(
      (acc: { [pair: string]: bigint }, cur) => {
        acc[cur.pair] = convertToNewDecimals(
          state.chainlink[cur.pair].answer,
          8,
          18,
        );
        return acc;
      },
      {},
    );
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
