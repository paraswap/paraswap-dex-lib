import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Log, Logger } from '../../types';
import { catchParseLogError } from '../../utils';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { PoolState } from './types';
import GSM_ABI from '../../abi/aave-gsm/Aave_GSM.json';
import FEE_STRATEGY_ABI from '../../abi/aave-gsm/IFeeStrategy.json';
import { addressDecode, uint256ToBigInt } from '../../lib/decoders';

export class AaveGsmEventPool extends StatefulEventSubscriber<PoolState> {
  handlers: {
    [event: string]: (
      event: any,
      state: DeepReadonly<PoolState>,
      log: Readonly<Log>,
    ) => Promise<DeepReadonly<PoolState> | null>;
  } = {};

  logDecoder: (log: Log) => any;

  addressesSubscribed: string[];

  constructor(
    readonly gsm: string,
    readonly parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    protected aaveGsmIface = new Interface(GSM_ABI),
    protected feeStrategyIface = new Interface(FEE_STRATEGY_ABI),
    protected PERCENT_FACTOR = 10_000n,
  ) {
    super(parentName, `${parentName}_${gsm}`, dexHelper, logger);

    this.logDecoder = (log: Log) => this.aaveGsmIface.parseLog(log);
    this.addressesSubscribed = [gsm];

    // Add handlers
    this.handlers['FeeStrategyUpdated'] =
      this.handleFeeStrategyUpdated.bind(this);
  }

  getIdentifier(): string {
    return `${this.parentName}_${this.gsm}`;
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
  protected async processLog(
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): Promise<DeepReadonly<PoolState> | null> {
    try {
      const event = this.logDecoder(log);
      if (event.name in this.handlers) {
        return await this.handlers[event.name](event, state, log);
      }
    } catch (e) {
      catchParseLogError(e, this.logger);
    }

    return null;
  }

  async getFeeState(
    address: string,
    blockNumber: number | string = 'latest',
  ): Promise<PoolState> {
    const callData = [
      {
        target: address,
        callData: this.feeStrategyIface.encodeFunctionData('getBuyFee', [
          this.PERCENT_FACTOR,
        ]),
        decodeFunction: uint256ToBigInt,
      },
      {
        target: address,
        callData: this.feeStrategyIface.encodeFunctionData('getSellFee', [
          this.PERCENT_FACTOR,
        ]),
        decodeFunction: uint256ToBigInt,
      },
      {
        target: this.gsm,
        callData: this.aaveGsmIface.encodeFunctionData(
          'getAvailableLiquidity',
          [],
        ),
        decodeFunction: uint256ToBigInt,
      },
    ];

    const results = await this.dexHelper.multiWrapper.tryAggregate<bigint>(
      true,
      callData,
      blockNumber,
    );

    return {
      buyFee: results[0].returnData,
      sellFee: results[1].returnData,
      underlyingLiquidity: results[2].returnData,
    };
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
    blockNumber: number | string = 'latest',
  ): Promise<DeepReadonly<PoolState>> {
    const callData = [
      {
        target: this.gsm,
        callData: this.aaveGsmIface.encodeFunctionData('getFeeStrategy', []),
        decodeFunction: addressDecode,
      },
    ];

    const results = await this.dexHelper.multiWrapper.tryAggregate<string>(
      true,
      callData,
      blockNumber,
    );

    return await this.getFeeState(results[0].returnData, blockNumber);
  }

  async handleFeeStrategyUpdated(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): Promise<DeepReadonly<PoolState> | null> {
    const feeStrategy = addressDecode(event.args.newFeeStrategy);
    return await this.getFeeState(feeStrategy);
  }
}
