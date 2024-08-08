import _ from 'lodash';
import { Interface } from '@ethersproject/abi';
import { IDexHelper } from '../../dex-helper';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { Address, Log, Logger } from '../../types';
import { AsyncOrSync, DeepReadonly } from 'ts-essentials';
import { FxProtocolPoolState } from './types';
import { BI_POWS } from '../../bigint-constants';
import { bigIntify, catchParseLogError } from '../../utils';
import { getOnChainState } from './utils';

export class fxProtocolRusdEvent extends StatefulEventSubscriber<FxProtocolPoolState> {
  decoder = (log: Log) => this.marketInterface.parseLog(log);

  constructor(
    parentName: string,
    protected dexHelper: IDexHelper,
    private marketAddress: Address,
    private marketInterface: Interface,
    private weETHOracleAddress: Address,
    private weETHOracleIface: Interface,
    logger: Logger,
  ) {
    super(parentName, 'fxProtocolRusd', dexHelper, logger);
    this.addressesSubscribed = [marketAddress, weETHOracleAddress];
  }

  protected processLog(
    state: DeepReadonly<FxProtocolPoolState>,
    log: Readonly<Log>,
  ): AsyncOrSync<DeepReadonly<FxProtocolPoolState> | null> {
    const event = this.decoder(log);
    try {
      const _state: FxProtocolPoolState = _.cloneDeep(state);
      if (event.name === 'UpdateRedeemFeeRatioFToken') {
        _state.redeemFee = bigIntify(event.args.defaultFeeRatio);
        return _state;
      } else if (event.name === 'AnswerUpdated') {
        _state.weETHPrice = bigIntify(event.args.current);
        return _state;
      }
      return null;
    } catch (e) {
      catchParseLogError(e, this.logger);
      return null;
    }
  }

  async generateState(
    blockNumber: number | 'latest' = 'latest',
  ): Promise<DeepReadonly<FxProtocolPoolState>> {
    const state = await getOnChainState(
      this.dexHelper.multiContract,
      this.marketAddress,
      this.marketInterface,
      this.weETHOracleAddress,
      this.weETHOracleIface,
      blockNumber,
    );
    return state;
  }

  getPrice(blockNumber: number, amount: bigint, isRedeem: boolean): bigint {
    const state = this.getState(blockNumber);
    if (!state) throw new Error('Cannot compute price');

    const { nav, redeemFee, weETHPrice } = state;
    const baseTokenPrice = BigInt(weETHPrice * BI_POWS[10]);

    if (isRedeem) {
      return BigInt(
        (amount * nav * (BI_POWS[18] - redeemFee)) /
          BI_POWS[18] /
          baseTokenPrice,
      );
    } else {
      return BigInt((baseTokenPrice * amount) / nav);
    }
  }
}
