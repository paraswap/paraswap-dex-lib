import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Address, Log, Logger } from '../../types';
import { catchParseLogError } from '../../utils';
import {
  InitializeStateOptions,
  StatefulEventSubscriber,
} from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { ChainlinkState } from './types';
import OracleABI from '../../abi/angle-transmuter/ChainlinkAccessControlledOffchainAggregator.json';
import ProxyABI from '../../abi/angle-transmuter/ChainlinkEACAggregatorProxy.json';
import { formatUnits } from 'ethers/lib/utils';
import { BigNumber } from 'ethers';
import { MultiCallParams } from '../../lib/multi-wrapper';
import { addressDecode } from '../../lib/decoders';

export class ChainlinkEventFeed extends StatefulEventSubscriber<ChainlinkState> {
  handlers: {
    [event: string]: (
      event: any,
      state: ChainlinkState,
      log: Readonly<Log>,
    ) => DeepReadonly<ChainlinkState> | null;
  } = {};

  logDecoder: (log: Log) => any;

  addressesSubscribed: string[];

  public decimals: number = 0;

  constructor(
    readonly parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    protected angleOracleIface = new Interface(OracleABI.concat(ProxyABI)),
    readonly oracleAddress: Address, // TODO: add any additional params required for event subscriber
  ) {
    // TODO: Add oracle name
    super(parentName, `Oracle-${oracleAddress}`, dexHelper, logger);

    // TODO: make logDecoder decode logs that
    this.logDecoder = (log: Log) => this.angleOracleIface.parseLog(log);

    this.addressesSubscribed = [oracleAddress];

    // Add handlers
    this.handlers['AnswerUpdated'] = this.handleAnswerUpdated.bind(this);
    // TODO There aren't any event to detect if the aggregator changed
  }

  async initialize(
    blockNumber: number,
    options?: InitializeStateOptions<ChainlinkState>,
  ) {
    await super.initialize(blockNumber, options);
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
    state: ChainlinkState,
    log: Readonly<Log>,
  ): ChainlinkState | null {
    try {
      const event = this.logDecoder(log);
      if (event.name in this.handlers) {
        return this.handlers[event.name](event, state, log);
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
  async generateState(
    blockNumber: number,
  ): Promise<DeepReadonly<ChainlinkState>> {
    const callData: MultiCallParams<Address | Number | BigNumber>[] = [
      {
        target: this.oracleAddress,
        callData: this.angleOracleIface.encodeFunctionData('aggregator', []),
        decodeFunction: addressDecode,
      },
      {
        target: this.oracleAddress,
        callData: this.angleOracleIface.encodeFunctionData('decimals', []),
        decodeFunction: addressDecode,
      },
      {
        target: this.oracleAddress,
        callData: this.angleOracleIface.encodeFunctionData('latestAnswer', []),
        decodeFunction: addressDecode,
      },
    ];
    const [aggregator, decimals, value] =
      await this.dexHelper.multiWrapper.tryAggregate<
        Address | Number | BigNumber
      >(
        false,
        callData,
        blockNumber,
        this.dexHelper.multiWrapper.defaultBatchSize,
        false,
      );
    this.decimals = decimals.returnData as number;
    if (this.addressesSubscribed.length == 2)
      this.addressesSubscribed[1] = aggregator.returnData as Address;
    else this.addressesSubscribed.push(aggregator.returnData as Address);

    return {
      oracle: this.oracleAddress,
      aggregator: aggregator.returnData as Address,
      value: Number(formatUnits(value.returnData as BigNumber, this.decimals)),
    };
  }

  /**
   * Update feed update answer
   */
  handleAnswerUpdated(
    event: any,
    state: ChainlinkState,
    log: Readonly<Log>,
  ): Readonly<ChainlinkState> | null {
    state.value = Number(formatUnits(event.args.current, this.decimals));
    return state;
  }
}
