import { AbiCoder, Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Log, Logger } from '../../types';
import { catchParseLogError } from '../../utils';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { PoolState } from './types';
import curveABI from '../../abi/stabull/stabull-curve.json';

export class StabullEventPool extends StatefulEventSubscriber<PoolState> {
  handlers: {
    [event: string]: (
      event: any,
      state: DeepReadonly<PoolState>,
      log: Readonly<Log>,
    ) => DeepReadonly<PoolState> | null;
  } = {};

  logDecoder: (log: Log) => any;

  coder = new AbiCoder();

  addressesSubscribed: string[];
  poolAddress: string;

  constructor(
    readonly parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    protected poolAddress_: string,
    protected addressesSubscribed_: string[],
    logger: Logger,
    protected stabullIface = new Interface(curveABI),
  ) {
    super(parentName, `StabullPool-${poolAddress_}`, dexHelper, logger);

    this.logDecoder = (log: Log) => this.stabullIface.parseLog(log);
    this.addressesSubscribed = addressesSubscribed_;
    this.poolAddress = poolAddress_.toLowerCase();

    // Add handlers
    this.handlers['Transfer'] = this.handleTransfer.bind(this);
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
  ): DeepReadonly<PoolState> | null {
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
  async generateState(blockNumber: number): Promise<DeepReadonly<PoolState>> {
    let calldata = [
      {
        target: this.addressesSubscribed[0],
        callData: this.stabullIface.encodeFunctionData('balanceOf', [
          this.poolAddress,
        ]),
      },
      {
        target: this.addressesSubscribed[1],
        callData: this.stabullIface.encodeFunctionData('balanceOf', [
          this.poolAddress,
        ]),
      },
    ];

    const data: { returnData: any[] } =
      await this.dexHelper.multiContract.methods
        .aggregate(calldata)
        .call({}, blockNumber);

    const decodedData0 = this.coder.decode(['uint256'], data.returnData[0]);
    const decodedData1 = this.coder.decode(['uint256'], data.returnData[1]);
    return {
      reserves0: decodedData0.toString(),
      reserves1: decodedData1.toString(),
    };
  }

  /**
   * Handles a transfer event and updates the pool state accordingly.
   *
   * @param event - The transfer event object containing details about the transfer.
   * @param state - The current state of the pool.
   * @param log - The log object containing additional information about the event.
   * @returns The updated pool state if the transfer involves the pool, otherwise null.
   */
  handleTransfer(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    const poolAddress = this.poolAddress.toLowerCase();
    const from = event.args.from.toLowerCase();
    const to = event.args.to.toLowerCase();

    // Check if pool is involved in the transfer
    if (from !== poolAddress && to !== poolAddress) {
      return null;
    }

    // Determine which token this is
    const eventTokenAddress = log.address.toLowerCase();
    const isToken0 =
      eventTokenAddress === this.addressesSubscribed[0].toLowerCase();
    const isToken1 =
      eventTokenAddress === this.addressesSubscribed[1].toLowerCase();

    if (!isToken0 && !isToken1) {
      return null;
    }

    const value = event.args.value.toString();
    const reserveKey = isToken0 ? 'reserves0' : 'reserves1';
    const currentReserve = state[reserveKey];

    // Pool is sending tokens (decrease) or receiving tokens (increase)
    const isFromPool = from === poolAddress;
    const newReserve = isFromPool
      ? (BigInt(currentReserve) - BigInt(value)).toString()
      : (BigInt(currentReserve) + BigInt(value)).toString();

    return {
      ...state,
      [reserveKey]: newReserve,
    };
  }
}
