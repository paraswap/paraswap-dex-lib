import { Interface } from '@ethersproject/abi';
import { DeepReadonly, assert } from 'ts-essentials';
import D3MMABI from '../../abi/dodo-v3/D3MM.abi.json';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { Address, BlockHeader, Log, Logger } from '../../types';
import { catchParseLogError } from '../../utils';
import { addressArrayDecode } from './dodo-v3-vault';
import { PoolState } from './types';

export class DodoV3EventPool extends StatefulEventSubscriber<PoolState> {
  handlers: {
    [event: string]: (
      event: any,
      state: DeepReadonly<PoolState>,
      log: Readonly<Log>,
      blockHeader: Readonly<BlockHeader>,
    ) => DeepReadonly<PoolState> | null;
  } = {};

  logDecoder: (log: Log) => any;

  readonly D3MMAddress: Address;

  public readonly D3MMIface = new Interface(D3MMABI);

  addressesSubscribed: string[];

  constructor(
    readonly parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    newD3Address: string,
  ) {
    super(parentName, newD3Address, dexHelper, logger);

    this.D3MMAddress = newD3Address;

    this.logDecoder = (log: Log) => this.D3MMIface.parseLog(log);
    this.addressesSubscribed = [newD3Address];

    // The tokens deposited into d3mm by makerDeposit, which are not in the vault, can participate in the transaction after SetNewToken is called by the maker.
    // However, SetNewToken is thrown in the maker contract and cannot be listened to. We assume that the user will definitely call SetNewToken after makerDeposit, so we only need to listen to the makerDeposit event to get the token. If the user only calls makerDeposit and does not call SetNewToken, it will lead to getTokenMMInfoForPool returning an invalid token, i.e., the price cannot be obtained.
    this.handlers['MakerDeposit'] = this.handleMakerDeposit.bind(this);
  }

  /**
   * The function is called every time any of the subscribed
   * addresses release log. The function accepts the current
   * state, updates the state according to the log, and returns
   * the updated state.
   * @param state - Current state of event subscriber
   * @param log - Log released by one of the subscribed addresses
   * @returns Updates state of the event subscriber after the log
   */
  protected processLog(
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): DeepReadonly<PoolState> | null {
    try {
      const event = this.logDecoder(log);
      if (event.name in this.handlers) {
        return this.handlers[event.name](event, state, log, blockHeader);
      }
    } catch (e) {
      catchParseLogError(e, this.logger);
    }

    return null;
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
  async generateState(blockNumber: number): Promise<DeepReadonly<PoolState>> {
    const [resTokenList] = await this.dexHelper.multiWrapper.tryAggregate<
      Array<Address>
    >(
      false,
      [
        {
          target: this.D3MMAddress,
          callData: this.D3MMIface.encodeFunctionData(
            'getDepositedTokenList',
            [],
          ),
          decodeFunction: addressArrayDecode,
        },
      ],
      blockNumber,
      this.dexHelper.multiWrapper.defaultBatchSize,
      false,
    );
    this.logger.info(`${this.D3MMAddress} getDepositedTokenList`, resTokenList);

    assert(resTokenList.success, 'Failed to fetch token list');
    const depositedTokenList = resTokenList.returnData;

    return {
      D3MMAddress: this.D3MMAddress,
      depositedTokenList,
    };
  }

  handleMakerDeposit(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): DeepReadonly<PoolState> | null {
    const token = event.args.token.toLowerCase();

    if (state.depositedTokenList.indexOf(token) === -1) {
      return {
        ...state,
        depositedTokenList: [...state.depositedTokenList, token],
      };
    }

    return state;
  }
}
