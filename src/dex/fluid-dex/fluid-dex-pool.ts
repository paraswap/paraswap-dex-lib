import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Log, Logger } from '../../types';
import { catchParseLogError } from '../../utils';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import FluidDexABI from '../../abi/fluid-dex/fluid-dex.abi.json';
import { FluidDexPool, FluidDexPoolState } from './types';

export class FluidDexEventPool extends StatefulEventSubscriber<FluidDexPoolState> {
  handlers: {
    [event: string]: (
      event: any,
      state: DeepReadonly<FluidDexPoolState>,
      log: Readonly<Log>,
    ) => DeepReadonly<FluidDexPoolState> | null;
  } = {};

  logDecoder: (log: Log) => any;

  addressesSubscribed: string[];

  constructor(
    readonly parentName: string,
    readonly pool: FluidDexPool,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    protected fluidDexIface = new Interface(FluidDexABI), // TODO: add any additional params required for event subscriber
  ) {
    // TODO: Add pool name
    super(parentName, pool.id, dexHelper, logger);

    // TODO: make logDecoder decode logs that
    this.logDecoder = (log: Log) => this.fluidDexIface.parseLog(log);
    this.addressesSubscribed = [pool.address, pool.token0, pool.token1];

    // Add handlers
    // this.handlers['Swap'] = this.handleSwap.bind(this);
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
    state: DeepReadonly<FluidDexPoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<FluidDexPoolState> | null {
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

  async getStateOrGenerate(
    blockNumber: number,
    readonly: boolean = true,
  ): Promise<FluidDexPoolState> {
    let state = this.getState(blockNumber);
    if (!state) {
      state = await this.generateState(blockNumber);
      if (!readonly) this.setState(state, blockNumber);
    }
    return state;
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
  ): Promise<DeepReadonly<FluidDexPoolState>> {
    // TODO: complete me!
    const poolReserves = await this.dexHelper.multiContract.methods
      .getPoolReserves(this.pool.address)
      .call({}, blockNumber);

    return poolReserves;
    // return {
    //   token0RealReserves: poolReserves.collateralReserves.token0RealReserves.toString(),
    //   token1RealReserves: poolReserves.collateralReserves.token1RealReserves.toString(),
    //   token0ImaginaryReserves: poolReserves.collateralReserves.token0ImaginaryReserves.toString(),
    //   token1ImaginaryReserves: poolReserves.collateralReserves.token1ImaginaryReserves.toString(),
    //   token0Debt: poolReserves.debtReserves.token0Debt.toString(),
    //   token1Debt: poolReserves.debtReserves.token1Debt.toString(),
    // };
  }

  // Its just a dummy example
  handleMyEvent(
    event: any,
    state: DeepReadonly<FluidDexPoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<FluidDexPoolState> | null {
    return null;
  }
}
