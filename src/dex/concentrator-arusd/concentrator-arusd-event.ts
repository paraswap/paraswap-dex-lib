import _ from 'lodash';
import { Interface } from '@ethersproject/abi';
import { IDexHelper } from '../../dex-helper';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { Address, Log, Logger } from '../../types';
import { AsyncOrSync, DeepReadonly } from 'ts-essentials';
import { ConcentratorArusdState } from './types';
import { BI_POWS } from '../../bigint-constants';
import { bigIntify } from '../../utils';
import { getOnChainState } from './utils';

export class ConcentratorArusdEvent extends StatefulEventSubscriber<ConcentratorArusdState> {
  decoder = (log: Log) => this.poolInterface.parseLog(log);

  constructor(
    parentName: string,
    protected dexHelper: IDexHelper,
    private poolAddress: Address,
    private poolInterface: Interface,
    logger: Logger,
  ) {
    super(parentName, 'ConcentratorArusd', dexHelper, logger);
    this.addressesSubscribed = [poolAddress];
  }

  protected processLog(
    state: DeepReadonly<ConcentratorArusdState>,
    log: Readonly<Log>,
  ): AsyncOrSync<DeepReadonly<ConcentratorArusdState> | null> {
    const event = this.decoder(log);
    const _state: ConcentratorArusdState = _.cloneDeep(state);
    if (event.name === 'Deposit') {
      _state.totalSupply += bigIntify(event.args.amountSyOut);
      _state.totalAssets += bigIntify(event.args.amountDeposited);
      return _state;
    } else if (event.name === 'Redeem') {
      _state.totalSupply -= bigIntify(event.args.amountSyToRedeem);
      _state.totalAssets -= bigIntify(event.args.amountTokenOut);
      return _state;
    }
    return null;
  }

  async generateState(
    blockNumber: number | 'latest' = 'latest',
  ): Promise<DeepReadonly<ConcentratorArusdState>> {
    const state = await getOnChainState(
      this.dexHelper.multiContract,
      this.poolAddress,
      this.poolInterface,
      blockNumber,
    );
    return state;
  }

  getPrice(
    blockNumber: number,
    ethAmount: bigint,
    is_deposit: boolean,
  ): bigint {
    const state = this.getState(blockNumber);
    if (!state) throw new Error('Cannot compute price');
    const { totalSupply, totalAssets } = state;
    const nav = (BigInt(totalAssets) * BI_POWS[18]) / BigInt(totalSupply);
    if (is_deposit) {
      return BigInt((ethAmount * BI_POWS[18]) / nav);
    }
    return BigInt((nav * ethAmount) / BI_POWS[18]);
  }
}
