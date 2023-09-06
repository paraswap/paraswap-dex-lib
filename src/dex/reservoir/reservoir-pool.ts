import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Log, Logger, Token } from '../../types';
import { catchParseLogError } from '../../utils';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { ReservoirPoolState, ReservoirPoolTypes } from './types';
import ReservoirPairABI from '../../abi/reservoir/ReservoirPair.json';
import { Address } from '@paraswap/core';

export class ReservoirEventPool extends StatefulEventSubscriber<ReservoirPoolState> {
  handlers: {
    [event: string]: (
      event: any,
      state: DeepReadonly<ReservoirPoolState>,
      log: Readonly<Log>,
    ) => DeepReadonly<ReservoirPoolState> | null;
  } = {};

  constructor(
    readonly parentName: string,
    protected dexHelper: IDexHelper,
    private poolAddress: Address,
    private token0: Token,
    private token1: Token,
    private curveId: ReservoirPoolTypes,
    logger: Logger,
    protected reservoirIface = new Interface(ReservoirPairABI),
  ) {
    const poolName = token0.address + '-' + token1.address + '-' + curveId;
    super(parentName, poolName, dexHelper, logger);

    // I think we're not taking this approach
    // // TODO: make logDecoder decode logs that
    // this.logDecoder = (log: Log) => this.reservoirIface.parseLog(log);
    // this.addressesSubscribed = [
    //   /* subscribed addresses */
    // ];
    //
    // // Add handlers
    // this.handlers['myEvent'] = this.handleMyEvent.bind(this);
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
    state: DeepReadonly<ReservoirPoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<ReservoirPoolState> | null {
    try {
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
  ): Promise<DeepReadonly<ReservoirPoolState>> {
    // TODO: complete me!

    return {
      reserve0: 0n,
      reserve1: 0n,
      curveId: 0,
      swapFee: 0n,
    };
  }
}
