import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Log, Logger, BlockHeader } from '../../types';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { UniswapV3Data, PoolState } from './types';
import { UniswapV3Config } from './config';

export class UniswapV3EventPool extends StatefulEventSubscriber<PoolState> {
  handlers: {
    [event: string]: (
      event: any,
      pool: PoolState,
      log: Log,
      blockHeader: Readonly<BlockHeader>,
    ) => PoolState;
  } = {};

  logDecoder: (log: Log) => any;

  addressesSubscribed: string[];

  constructor(
    protected parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    protected uniswapV3Iface = new Interface(
      '' /* TODO: Import and put here UniswapV3 ABI */,
    ), // TODO: add any additional params required for event subscriber
  ) {
    super(parentName, logger);

    // TODO: make logDecoder decode logs that
    this.logDecoder = (log: Log) => this.uniswapV3Iface.parseLog(log);
    this.addressesSubscribed = [
      /* subscribed addresses */
    ];

    // Add handlers
    this.handlers['myEvent'] = this.handleMyEvent.bind(this);
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
        // Because we have observations in array which is mutable by nature, there is a
        // ts compile error: https://stackoverflow.com/questions/53412934/disable-allowing-assigning-readonly-types-to-non-readonly-types
        // And there is no good workaround, so turn off the type checker for this line
        // @ts-expect-error
        return this.handlers[event.name](event, state, log, blockHeader);
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

  /**
   * The function generates state using on-chain calls. This
   * function is called to regenerate state if the event based
   * system fails to fetch events and the local state is no
   * more correct.
   * @param blockNumber - Blocknumber for which the state should
   * should be generated
   * @returns state of the event subscriber at blocknumber
   */
  async generateState(blockNumber: number): Promise<Readonly<PoolState>> {
    // TODO: complete me!
    return {
      blockTimestamp: 0n,
      tickSpacing: 0n,
      fee: 0n,
      slot0: {
        sqrtPriceX96: 0n,
        tick: 0n,
        observationIndex: 0,
        observationCardinality: 0,
        observationCardinalityNext: 0,
        feeProtocol: 0n,
      },
      liquidity: 0n,
      tickBitMap: {},
      ticks: {},
      observations: [],
      positions: {},
      maxLiquidityPerTick: 0n,
    };
  }

  // Its just a dummy example
  handleMyEvent(event: any, pool: PoolState, log: Log) {
    return pool;
  }
}
