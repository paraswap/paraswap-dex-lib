import { Interface } from '@ethersproject/abi';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { Address, Log, Logger } from '../../types';
import { DeepReadonly } from 'ts-essentials';
import { catchParseLogError } from '../../utils';
import { ETHxPoolState } from './types';
import { getOnChainStateETHx } from './utils';
import { BI_POWS } from '../../bigint-constants';

export class ETHxEventPool extends StatefulEventSubscriber<ETHxPoolState> {
  decoder = (log: Log) => this.poolInterface.parseLog(log);
  DECIMALS = 1000000000000000000n;
  addressesSubscribed: string[];

  constructor(
    parentName: string,
    protected dexHelper: IDexHelper,
    private poolAddress: Address,
    private poolInterface: Interface,
    logger: Logger,
  ) {
    super(parentName, 'ETHx', dexHelper, logger);
    this.addressesSubscribed = [poolAddress];
  }

  protected processLog(
    state: DeepReadonly<ETHxPoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<ETHxPoolState> | null {
    try {
      const event = this.decoder(log);
      if (event.name === 'ExchangeRateUpdated') {
        const totalEth = BigInt(event.args.totalEth);
        const ethxSupply = BigInt(event.args.ethxSupply);
        return {
          totalETHBalance: totalEth,
          totalETHXSupply: ethxSupply,
        };
      }
    } catch (e) {
      catchParseLogError(e, this.logger);
    }

    return null;
  }

  async generateState(
    blockNumber: number,
  ): Promise<DeepReadonly<ETHxPoolState>> {
    const state = await getOnChainStateETHx(
      this.dexHelper.multiContract,
      this.poolAddress,
      this.poolInterface,
      blockNumber,
    );

    return state;
  }

  getPrice(blockNumber: number, ethAmount: bigint): bigint {
    const state = this.getState(blockNumber);
    if (!state) throw new Error('Cannot compute price');
    const { totalETHBalance, totalETHXSupply } = state;

    return (ethAmount * totalETHXSupply) / totalETHBalance;
  }
}
