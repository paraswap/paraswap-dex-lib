import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { IDexHelper } from '../../../dex-helper';
import { StatefulEventSubscriber } from '../../../stateful-event-subscriber';
import { Log, Logger } from '../../../types';
import { PoolState } from '../types';

export abstract class BaseCurveEventPool extends StatefulEventSubscriber<PoolState> {
  handlers: {
    [event: string]: (event: any, pool: PoolState, log: Log) => PoolState;
  } = {};

  logDecoder: (log: Log) => any;

  addressesSubscribed: string[];

  protected constructor(
    protected parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    protected curveIface = new Interface(
      '' /* TODO: Import and put here Curve ABI */,
    ), // TODO: add any additional params required for event subscriber
  ) {
    super(parentName, logger);

    // TODO: make logDecoder decode logs that
    this.logDecoder = (log: Log) => this.curveIface.parseLog(log);
    this.addressesSubscribed = [
      /* subscribed addresses */
    ];

    // Add handlers
    this.handlers['myEvent'] = this.handleMyEvent.bind(this);
  }

  protected processLog(
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    try {
      const event = this.logDecoder(log);
      if (event.name in this.handlers) {
        return this.handlers[event.name](event, state, log);
      }
      return state;
    } catch (e) {
      this.logger.error(
        `Error_${this.parentName}_processLog could not parse the log with topic ${log.topics}:`,
        e,
      );
      return null;
    }
  }

  // Its just a dummy example
  handleMyEvent(event: any, pool: PoolState, log: Log) {
    return pool;
  }
}
