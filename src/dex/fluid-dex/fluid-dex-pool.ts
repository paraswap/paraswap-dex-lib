import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Log, Logger } from '../../types';
import { catchParseLogError } from '../../utils';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import FluidDexPoolABI from '../../abi/fluid-dex/fluid-dex.abi.json';
import ResolverABI from '../../abi/fluid-dex/resolver.abi.json';
import LiquidityABI from '../../abi/fluid-dex/liquidityUserModule.abi.json';
import { FluidDexPool, FluidDexPoolState, PoolWithReserves } from './types';
import { ethers } from 'ethers';
import { eachOfSeries } from 'async';
import { USD_PRECISION } from '../woo-fi-v2/constants';
import { MultiResult, MultiCallParams } from '../../lib/multi-wrapper';
import { BytesLike, defaultAbiCoder } from 'ethers/lib/utils';
import { Address } from '../../types';
import { generalDecoder } from '../../lib/decoders';

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
  protected liquidityIface = new Interface(LiquidityABI); // TODO: add any additional params required for event subscriber

  constructor(
    readonly parentName: string,
    readonly pool: FluidDexPool,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
  ) {
    // TODO: Add pool name
    super(parentName, pool.id, dexHelper, logger);

    // TODO: make logDecoder decode logs that
    this.logDecoder = (log: Log) => this.liquidityIface.parseLog(log);
    this.addressesSubscribed = [pool.liquidityUserModule];

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
    const ResolverAbi = new Interface(ResolverABI);
    if (
      !(
        event.args.user in
        [
          this.pool.address,
          this.pool.colOperations,
          this.pool.debtOperations,
          this.pool.perfectOperationsAndSwapOut,
        ]
      )
    ) {
      return null;
    }
    const callData: MultiCallParams<PoolWithReserves>[] = [
      {
        target: this.pool.resolver,
        callData: ResolverAbi.encodeFunctionData('getCollateralReserves', [
          this.pool.address,
        ]),
        decodeFunction: await this.decodePoolWithReserves,
      },
    ];

    const results: PoolWithReserves[] =
      await this.dexHelper.multiWrapper.aggregate<PoolWithReserves>(
        callData,
        await this.dexHelper.provider.getBlockNumber(),
        this.dexHelper.multiWrapper.defaultBatchSize,
      );

    return {
      collateralReserves: results[0].collateralReserves,
      debtReserves: results[0].debtReserves,
    };
  }

  decodePoolWithReserves = (
    result: MultiResult<BytesLike> | BytesLike,
  ): PoolWithReserves => {
    return generalDecoder(
      result,
      [
        'tuple(address pool, address token0_, address token1_, ' +
          'tuple(uint256 token0RealReserves, uint256 token1RealReserves, uint256 token0ImaginaryReserves, uint256 token1ImaginaryReserves) collateralReserves, ' +
          'tuple(uint256 token0Debt, uint256 token1Debt, uint256 token0RealReserves, uint256 token1RealReserves, uint256 token0ImaginaryReserves, uint256 token1ImaginaryReserves) debtReserves)',
      ],
      undefined,
      decoded => {
        const [decodedResult] = decoded;
        return {
          pool: decodedResult.pool,
          token0_: decodedResult.token0_,
          token1_: decodedResult.token1_,
          collateralReserves: {
            token0RealReserves: BigInt(
              decodedResult.collateralReserves.token0RealReserves,
            ),
            token1RealReserves: BigInt(
              decodedResult.collateralReserves.token1RealReserves,
            ),
            token0ImaginaryReserves: BigInt(
              decodedResult.collateralReserves.token0ImaginaryReserves,
            ),
            token1ImaginaryReserves: BigInt(
              decodedResult.collateralReserves.token1ImaginaryReserves,
            ),
          },
          debtReserves: {
            token0Debt: BigInt(decodedResult.debtReserves.token0Debt),
            token1Debt: BigInt(decodedResult.debtReserves.token1Debt),
            token0RealReserves: BigInt(
              decodedResult.debtReserves.token0RealReserves,
            ),
            token1RealReserves: BigInt(
              decodedResult.debtReserves.token1RealReserves,
            ),
            token0ImaginaryReserves: BigInt(
              decodedResult.debtReserves.token0ImaginaryReserves,
            ),
            token1ImaginaryReserves: BigInt(
              decodedResult.debtReserves.token1ImaginaryReserves,
            ),
          },
        };
      },
    );
  };

  extractSuccessAndValue = (
    result: MultiResult<BytesLike> | BytesLike,
  ): [boolean, BytesLike] => {
    return this.isMultiResult(result)
      ? [result.success, result.returnData]
      : [true, result];
  };

  isMultiResult = (
    result: MultiResult<BytesLike> | BytesLike,
  ): result is MultiResult<BytesLike> => {
    return (
      typeof result === 'object' &&
      result !== null &&
      'success' in result &&
      'returnData' in result
    );
  };

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
    readonly: boolean = true,
  ): Promise<FluidDexPoolState> {
    let state = this.getState(blockNumber);
    if (!state) {
      state = await this.generateState(blockNumber);
      if (!readonly) this.setState(state, blockNumber);
    }
    // console.log('fluidDexPool - getStateOrGenerate : ' + state);
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
    const ResolverAbi = new Interface(ResolverABI);
    const callData: MultiCallParams<PoolWithReserves>[] = [
      {
        target: this.pool.resolver,
        callData: ResolverAbi.encodeFunctionData('getPoolReserves', [
          this.pool.address,
        ]),
        decodeFunction: await this.decodePoolWithReserves,
      },
    ];

    const results: PoolWithReserves[] =
      await this.dexHelper.multiWrapper.aggregate<PoolWithReserves>(
        callData,
        blockNumber,
        this.dexHelper.multiWrapper.defaultBatchSize,
      );

    // console.log('fluidDexpool - generateState results: ' + results);

    return {
      collateralReserves: results[0].collateralReserves,
      debtReserves: results[0].debtReserves,
    };
  }
}
