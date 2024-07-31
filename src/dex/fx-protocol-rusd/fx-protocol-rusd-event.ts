import _ from 'lodash';
import { Interface } from '@ethersproject/abi';
import { IDexHelper } from '../../dex-helper';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { Address, Log, Logger } from '../../types';
import { AsyncOrSync, DeepReadonly } from 'ts-essentials';
import { FxProtocolPoolState } from './types';
import { BI_POWS } from '../../bigint-constants';
import { NULL_ADDRESS } from '../../constants';
import { bigIntify, catchParseLogError } from '../../utils';
import { getOnChainState } from './utils';
import { number } from 'joi';

export class fxProtocolRusdEvent extends StatefulEventSubscriber<FxProtocolPoolState> {
  decoder = (log: Log) => this.poolInterface.parseLog(log);

  constructor(
    parentName: string,
    protected dexHelper: IDexHelper,
    private poolAddress: Address,
    private poolInterface: Interface,
    private marketAddress: Address,
    private marketInterface: Interface,
    private weETHOracleAddress: Address,
    private weETHOracleIface: Interface,
    logger: Logger,
  ) {
    super(parentName, 'fxProtocolRusd', dexHelper, logger);
    this.addressesSubscribed = [poolAddress, weETHOracleAddress];
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
      } else if (event.name === 'updateDataFeedsValues') {
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

  getPrice(blockNumber: number, amount: bigint, is_redeem: boolean): bigint {
    const state = this.getState(blockNumber);
    if (!state) throw new Error('Cannot compute price');
    const { nav, redeemFee, weETHPrice } = state;
    const baseTokenPrice = BigInt(weETHPrice * BI_POWS[10]);
    if (is_redeem) {
      const _redeemNum = BigInt(
        (amount * nav * (BI_POWS[18] - redeemFee)) /
          BI_POWS[18] /
          baseTokenPrice,
      );
      return _redeemNum;
    }
    const _mintNum = BigInt((baseTokenPrice * amount) / nav);
    return _mintNum;
  }
}
