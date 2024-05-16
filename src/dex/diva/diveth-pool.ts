import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { Logger } from 'log4js';
import { IDexHelper } from '../../dex-helper';
import { Address } from '@paraswap/core';
import { Interface } from '@ethersproject/abi';
import { AsyncOrSync, DeepReadonly } from 'ts-essentials';
import { Log } from '../../types';
import { DivETHPoolState } from './types';
import { ethers } from 'ethers';

export class DivETHEventPool extends StatefulEventSubscriber<DivETHPoolState> {
  decoder = (log: Log) => this.divaETHInterface.parseLog(log);

  constructor(
    parentName: string,
    protected dexHelper: IDexHelper,
    private divaETHAddress: Address,
    private divaETHInterface: Interface,
    logger: Logger,
  ) {
    super(parentName, 'diveth', dexHelper, logger);
    this.addressesSubscribed = [divaETHAddress];
  }

  protected processLog(
    state: DeepReadonly<DivETHPoolState>,
    log: Readonly<Log>,
  ): AsyncOrSync<DeepReadonly<DivETHPoolState> | null> {
    const event = this.decoder(log);
    if (event.name === 'TokenRebased')
      return {
        totalShares: BigInt(event.args.postTotalShares),
        totalEther: BigInt(event.args.postTotalEther),
      };

    return null;
  }


  async generateState(blockNumber: number | 'latest' = 'latest'): Promise<DeepReadonly<DivETHPoolState>> {
    const data: { returnData: any[] } = await this.dexHelper.multiContract.methods
      .aggregate([
        {
          target: this.divaETHAddress,
          callData: this.divaETHInterface.encodeFunctionData('totalEther', []),
        },
        {
          target: this.divaETHAddress,
          callData: this.divaETHInterface.encodeFunctionData('totalShares', []),
        },
      ])
      .call({}, blockNumber);

    const decodedData = data.returnData.map(d => ethers.utils.defaultAbiCoder.decode(['uint256'], d));
    const [totalEther, totalShares] = decodedData.map((d) => BigInt(d[0].toString()));

    return {
      totalEther,
      totalShares,
    };
  }

  convertToShares(blockNumber: number, assets: bigint): bigint {
    const state = this.getState(blockNumber);
    if (!state) throw new Error('Cannot compute price');
    const { totalEther, totalShares } = state;

    return (assets * totalShares) / totalEther;
  }

  convertToAssets(blockNumber: number, shares: bigint): bigint {
    const state = this.getState(blockNumber);
    if (!state) throw new Error('Cannot compute price');
    const { totalEther, totalShares } = state;

    return (shares * totalEther) / totalShares;
  }
}
