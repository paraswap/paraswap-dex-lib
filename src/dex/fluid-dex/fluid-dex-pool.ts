import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { BytesLike } from 'ethers/lib/utils';
import { Log, Logger } from '../../types';
import { catchParseLogError } from '../../utils';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import ResolverABI from '../../abi/fluid-dex/resolver.abi.json';
import LiquidityABI from '../../abi/fluid-dex/liquidityUserModule.abi.json';
import {
  CommonAddresses,
  FluidDexPoolState,
  PoolWithReserves,
  CollateralReserves,
  DebtReserves,
} from './types';
import { MultiResult } from '../../lib/multi-wrapper';
import { Address } from '../../types';
import { generalDecoder } from '../../lib/decoders';
import { Contract } from 'ethers';

export class FluidDexEventPool extends StatefulEventSubscriber<FluidDexPoolState> {
  handlers: {
    [event: string]: (
      event: any,
      state: DeepReadonly<FluidDexPoolState>,
      log: Readonly<Log>,
    ) => Promise<DeepReadonly<FluidDexPoolState> | null>;
  } = {};

  logDecoder: (log: Log) => any;

  addressesSubscribed: Address[];
  protected liquidityIface = new Interface(LiquidityABI);

  constructor(
    readonly parentName: string,
    readonly pool: Address,
    readonly commonAddresses: CommonAddresses,
    protected network: number,
    readonly dexHelper: IDexHelper,
    logger: Logger,
  ) {
    super(parentName, 'FluidDex_' + pool, dexHelper, logger);

    this.logDecoder = (log: Log) => this.liquidityIface.parseLog(log);
    this.addressesSubscribed = [commonAddresses.liquidityProxy];

    // Add handlers
    this.handlers['LogOperate'] = this.handleOperate.bind(this);
  }

  /**
   * Handle a trade rate change on the pool.
   */
  async handleOperate(
    event: any,
    state: DeepReadonly<FluidDexPoolState>,
    log: Readonly<Log>,
  ): Promise<DeepReadonly<FluidDexPoolState> | null> {
    if (!(event.args.user in [this.pool])) {
      return null;
    }
    const resolverContract = new Contract(
      this.commonAddresses.resolver,
      ResolverABI,
      this.dexHelper.provider,
    );
    const rawResult = await resolverContract.callStatic.getPoolReserves(
      this.pool,
      {
        blockTag: this.dexHelper.provider,
      },
    );

    const generatedState = this.convertToFluidDexPoolState(rawResult);

    this.setState(
      generatedState,
      await this.dexHelper.provider.getBlockNumber(),
    );

    return generatedState;
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
  async processLog(
    state: DeepReadonly<FluidDexPoolState>,
    log: Readonly<Log>,
  ): Promise<DeepReadonly<FluidDexPoolState> | null> {
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

  async getStateOrGenerate(
    blockNumber: number,
    readonly: boolean = false,
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
    const resolverContract = new Contract(
      this.commonAddresses.resolver,
      ResolverABI,
      this.dexHelper.provider,
    );
    const rawResult = await resolverContract.callStatic.getPoolReserves(
      this.pool,
      {
        blockTag: blockNumber,
      },
    );

    const convertedResult = this.convertToFluidDexPoolState(rawResult);

    return convertedResult;
  }

  private convertToFluidDexPoolState(input: any[]): FluidDexPoolState {
    // Ignore the first three addresses
    const [, , , feeHex, collateralReservesHex, debtReservesHex] = input;
    //  Convert fee from hex to number
    const fee = feeHex;

    // Convert collateral reserves
    const collateralReserves: CollateralReserves = {
      token0RealReserves: collateralReservesHex[0],
      token1RealReserves: collateralReservesHex[1],
      token0ImaginaryReserves: collateralReservesHex[2],
      token1ImaginaryReserves: collateralReservesHex[3],
    };

    // Convert debt reserves
    const debtReserves: DebtReserves = {
      token0Debt: debtReservesHex[0],
      token1Debt: debtReservesHex[1],
      token0RealReserves: debtReservesHex[2],
      token1RealReserves: debtReservesHex[3],
      token0ImaginaryReserves: debtReservesHex[4],
      token1ImaginaryReserves: debtReservesHex[5],
    };

    return {
      collateralReserves,
      debtReserves,
      fee,
    };
  }
}
