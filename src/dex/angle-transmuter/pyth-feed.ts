import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Address, Log, Logger } from '../../types';
import { catchParseLogError } from '../../utils';
import {
  InitializeStateOptions,
  StatefulEventSubscriber,
} from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { DecodedStateMultiCallResultPythOracle, PythState } from './types';
import PythABI from '../../abi/angle-transmuter/Pyth.json';
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import { BigNumber } from 'ethers';
import { MultiCallParams } from '../../lib/multi-wrapper';
import { decodeStatePyth } from './utils';

export class PythEventFeed extends StatefulEventSubscriber<PythState> {
  handlers: {
    [event: string]: (
      event: any,
      state: PythState,
      log: Readonly<Log>,
    ) => DeepReadonly<PythState> | null;
  } = {};

  logDecoder: (log: Log) => any;

  addressesSubscribed: string[];

  public decimals: number = 0;

  constructor(
    readonly parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    protected angleOracleIface = new Interface(PythABI),
    readonly pythAddress: Address, // TODO: add any additional params required for event subscriber
    readonly oracleHash: string, // TODO: add any additional params required for event subscriber
  ) {
    // TODO: Add oracle name
    super(parentName, `Oracle-${oracleHash}`, dexHelper, logger);

    // TODO: make logDecoder decode logs that
    this.logDecoder = (log: Log) => this.angleOracleIface.parseLog(log);

    this.addressesSubscribed = [pythAddress];

    // Add handlers
    this.handlers['PriceFeedUpdate'] = this.handlePriceFeedUpdate.bind(this);
  }

  async initialize(
    blockNumber: number,
    options?: InitializeStateOptions<PythState>,
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
  protected processLog(state: PythState, log: Readonly<Log>): PythState | null {
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
  async generateState(blockNumber: number): Promise<DeepReadonly<PythState>> {
    const callData: MultiCallParams<DecodedStateMultiCallResultPythOracle>[] = [
      {
        target: this.pythAddress,
        callData: this.angleOracleIface.encodeFunctionData('getPriceUnsafe', [
          this.oracleHash,
        ]),
        decodeFunction: decodeStatePyth,
      },
    ];

    const pythData = (
      await this.dexHelper.multiWrapper.tryAggregate<DecodedStateMultiCallResultPythOracle>(
        false,
        callData,
        blockNumber,
        this.dexHelper.multiWrapper.defaultBatchSize,
        false,
      )
    )[0];

    this.decimals = pythData.returnData.expo as number;

    const isNormalizerExpoNeg = pythData.returnData.expo < 0;
    if (isNormalizerExpoNeg)
      return {
        value: Number(
          formatUnits(pythData.returnData.price as BigNumber, this.decimals),
        ),
      };
    else
      return {
        value: Number(
          parseUnits(pythData.returnData.price.toString(), this.decimals),
        ),
      };
  }

  /**
   * Update feed update answer
   */
  handlePriceFeedUpdate(
    event: any,
    state: PythState,
    log: Readonly<Log>,
  ): Readonly<PythState> | null {
    if (event.args.id == this.oracleHash) {
      if (this.decimals)
        state.value = Number(formatUnits(event.args.price, this.decimals));
      else state.value = Number(formatUnits(event.args.price, this.decimals));
    }
    return state;
  }
}
