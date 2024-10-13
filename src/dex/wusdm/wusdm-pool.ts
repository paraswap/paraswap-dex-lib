import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { Interface } from '@ethersproject/abi';

import type { IDexHelper } from '../../dex-helper';
import type { DeepReadonly } from 'ts-essentials';
import type { Address, BlockHeader, Log, Logger } from '../../types';
import type { WusdmPoolState } from './types';
import { uint256ToBigInt } from '../../lib/decoders';
import { Network } from '../../constants';

export class WusdmEventPool extends StatefulEventSubscriber<WusdmPoolState> {
  logDecoder: (log: Log) => any;

  constructor(
    parentName: string,
    network: Network,
    poolName: string,
    protected dexHelper: IDexHelper,
    private wrapperAddress: Address,
    private wrapperInterface: Interface,
    logger: Logger,
    private depositTopic: string,
    private withdrawTopic: string,
  ) {
    super(parentName, poolName, dexHelper, logger);
    this.addressesSubscribed = [wrapperAddress];
    this.logDecoder = (log: Log) => this.wrapperInterface.parseLog(log);
  }

  protected async processLog(
    state: DeepReadonly<WusdmPoolState>,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): Promise<DeepReadonly<WusdmPoolState> | null> {
    const event = this.logDecoder(log);
    if (log.topics[0] === this.depositTopic) {
      return this.handleDeposit(event, state, log);
    }
    if (log.topics[0] === this.withdrawTopic) {
      return this.handleWithdraw(event, state, log);
    }
    return null;
  }

  async generateState(
    blockNumber: number | 'latest' = 'latest',
  ): Promise<DeepReadonly<WusdmPoolState>> {
    const calls = [
      {
        target: this.wrapperAddress,
        callData: this.wrapperInterface.encodeFunctionData('totalAssets', []),
        decodeFunction: uint256ToBigInt,
      },
      {
        target: this.wrapperAddress,
        callData: this.wrapperInterface.encodeFunctionData('totalSupply', []),
        decodeFunction: uint256ToBigInt,
      },
    ];

    const [totalAssets, totalSupply] =
      await this.dexHelper.multiWrapper.tryAggregate<bigint>(
        true,
        calls,
        blockNumber,
      );

    return {
      totalAssets: totalAssets.returnData,
      totalShares: totalSupply.returnData,
    };
  }

  async getOrGenerateState(blockNumber: number): Promise<WusdmPoolState> {
    let state = this.getState(blockNumber);
    if (!state) {
      state = await this.generateState(blockNumber);
      this.setState(state, blockNumber);
    }
    return state;
  }

  async handleDeposit(
    event: any,
    state: DeepReadonly<WusdmPoolState>,
    log: Readonly<Log>,
  ): Promise<DeepReadonly<WusdmPoolState>> {
    return {
      totalAssets: state.totalAssets + BigInt(event.args.assets),
      totalShares: state.totalAssets + BigInt(event.args.assets),
    };
  }

  async handleWithdraw(
    event: any,
    state: DeepReadonly<WusdmPoolState>,
    log: Readonly<Log>,
  ): Promise<DeepReadonly<WusdmPoolState>> {
    return {
      totalAssets: BigInt(state.totalAssets) - BigInt(event.args.assets),
      totalShares: BigInt(state.totalShares) - BigInt(event.args.shares),
    };
  }
}
