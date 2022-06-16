import _ from 'lodash';
import ethers from 'ethers';
import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import {
  Log,
  Logger,
  BlockHeader,
  Address,
  MultiCallV2Output,
} from '../../types';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { PoolState, TickInfo } from './types';
import UniswapV3PoolABI from '../../abi/uniswap-v3/UniswapV3Pool.abi.json';
import UniswapV3StateMulticallABI from '../../abi/uniswap-v3/UniswapV3StateMulticall.abi.json';
import { bigIntify } from '../../utils';
import { uniswapV3Math } from './contract-math/uniswap-v3-math';
import { BI_MAX_INT16 } from '../../bigint-constants';
import { NumberAsString } from 'paraswap-core';
import {
  LOWER_TICK_REQUEST_LIMIT,
  UPPER_TICK_REQUEST_LIMIT,
} from './constants';

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
  readonly token0: Address;
  readonly token1: Address;
  private _poolAddress?: Address;

  private _encodedStateRequestCallData?: {
    target: Address;
    callData: string;
  }[];

  constructor(
    protected parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    protected readonly stateMultiAddress: Address,
    protected readonly factoryAddress: Address,
    readonly feeCode: bigint,
    token0: Address,
    token1: Address,
    protected readonly poolIface = new Interface(UniswapV3PoolABI),
    protected readonly stateMultiIface = new Interface(
      UniswapV3StateMulticallABI,
    ),
  ) {
    super(`${parentName}_${token0}_${token1}_pool`, logger);
    this.token0 = token0.toLowerCase();
    this.token1 = token1.toLowerCase();
    this.logDecoder = (log: Log) => this.poolIface.parseLog(log);
    this.addressesSubscribed = new Array<Address>(1);

    // Add handlers
    this.handlers['Swap'] = this.handleSwapEvent.bind(this);
    this.handlers['Burn'] = this.handleBurnEvent.bind(this);
    this.handlers['Mint'] = this.handleMintEvent.bind(this);
    this.handlers['SetFeeProtocol'] = this.handleSetFeeProtocolEvent.bind(this);
    this.handlers['IncreaseObservationCardinalityNext'] =
      this.handleIncreaseObservationCardinalityNextEvent.bind(this);
  }

  get poolAddress() {
    if (this._poolAddress === undefined) {
      throw new Error(
        `${this.parentName}: First call generateState at least one time before requesting poolAddress`,
      );
    }
    return this._poolAddress;
  }

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

  private _getStateRequestCallData() {
    const target = this.stateMultiAddress;
    if (!this._encodedStateRequestCallData) {
      const callData = [
        {
          target,
          callData: this.stateMultiIface.encodeFunctionData('getFullState', [
            this.factoryAddress,
            this.token0,
            this.token1,
            this.feeCode,
            LOWER_TICK_REQUEST_LIMIT,
            UPPER_TICK_REQUEST_LIMIT,
          ]),
        },
      ];
      this._encodedStateRequestCallData = callData;
    }
    return this._encodedStateRequestCallData;
  }

  async generateState(blockNumber: number): Promise<Readonly<PoolState>> {
    const callData = this._getStateRequestCallData();

    const start = Date.now();
    const data = await this.dexHelper.multiContract.methods
      .tryAggregate(false, callData)
      .call({}, blockNumber || 'latest');

    const elapsed = Date.now() - start;
    console.log(elapsed);

    // I don't know why, but I receive "Returned values aren't valid, did it run Out of Gas?..." error
    // if I use "aggregate". Actually, I wanted to fail and catch the error outside, but it is not working
    // So, I use "tryAggregate(false, callData)" -> raise Error manually if not succeeded
    this._raiseIfNotAllSucceeded(data);

    const _state = this.stateMultiIface.decodeFunctionResult(
      'getFullState',
      data[0].returnData,
    ).state;

    // Not really a good place to do it, but in order to save RPC requests,
    // put it here
    this._poolAddress = _state.pool.toLowerCase();
    this.addressesSubscribed[0] = this.poolAddress;

    const tickBitmap = (
      _state.tickBitmap as { index: number; value: ethers.utils.BigNumber }[]
    ).reduce<Record<NumberAsString, bigint>>((acc, curr) => {
      const { index, value } = curr;
      acc[index] = bigIntify(value);
      return acc;
    }, {});

    const observations = new Array(65535);
    observations[_state.slot0.observationIndex] = {
      blockTimestamp: bigIntify(_state.observation.blockTimestamp),
      tickCumulative: bigIntify(_state.observation.tickCumulative),
      secondsPerLiquidityCumulativeX128: bigIntify(
        _state.observation.secondsPerLiquidityCumulativeX128,
      ),
      initialized: _state.observation.initialized,
    };

    const ticks = (_state.ticks as { index: number; value: TickInfo }[]).reduce<
      Record<string, TickInfo>
    >((acc, curr) => {
      const { index, value } = curr;
      acc[index] = {
        liquidityGross: bigIntify(value.liquidityGross),
        liquidityNet: bigIntify(value.liquidityNet),
        tickCumulativeOutside: bigIntify(value.tickCumulativeOutside),
        secondsPerLiquidityOutsideX128: bigIntify(
          value.secondsPerLiquidityOutsideX128,
        ),
        secondsOutside: bigIntify(value.secondsOutside),
        initialized: value.initialized,
      };
      return acc;
    }, {});

    return {
      blockTimestamp: bigIntify(_state.blockTimestamp),
      slot0: {
        sqrtPriceX96: bigIntify(_state.slot0.sqrtPriceX96),
        tick: bigIntify(_state.slot0.tick),
        observationIndex: _state.slot0.observationIndex,
        observationCardinality: _state.slot0.observationCardinality,
        observationCardinalityNext: _state.slot0.observationCardinalityNext,
        feeProtocol: bigIntify(_state.slot0.feeProtocol),
      },
      liquidity: bigIntify(_state.liquidity),
      fee: this.feeCode,
      tickSpacing: bigIntify(_state.tickSpacing),
      maxLiquidityPerTick: bigIntify(_state.maxLiquidityPerTick),
      tickBitmap,
      ticks,
      observations,
      isValid: true,
    };
  }

  handleSwapEvent(
    event: any,
    pool: PoolState,
    log: Log,
    blockHeader: BlockHeader,
  ) {
    const newSqrtPriceX96 = bigIntify(event.args.sqrtPriceX96);
    const newTick = bigIntify(event.args.tick);
    const newLiquidity = bigIntify(event.args.liquidity);
    pool.blockTimestamp = bigIntify(blockHeader.timestamp);

    uniswapV3Math.swapFromEvent(pool, newSqrtPriceX96, newTick, newLiquidity);

    return pool;
  }

  handleBurnEvent(
    event: any,
    pool: PoolState,
    log: Log,
    blockHeader: BlockHeader,
  ) {
    const amount = bigIntify(event.args.amount);
    const tickLower = bigIntify(event.args.tickLower);
    const tickUpper = bigIntify(event.args.tickUpper);
    pool.blockTimestamp = bigIntify(blockHeader.timestamp);

    try {
      // There is relevant just to update the ticks and other things for state
      uniswapV3Math._modifyPosition(pool, {
        tickLower,
        tickUpper,
        liquidityDelta: -amount,
      });
    } catch (e) {
      this.logger.error(
        'Unexpected error while handling Burn event for UniswapV3',
        e,
      );
      pool.isValid = false;
    }

    return pool;
  }

  handleMintEvent(
    event: any,
    pool: PoolState,
    log: Log,
    blockHeader: BlockHeader,
  ) {
    const amount = bigIntify(event.args.amount);
    const tickLower = bigIntify(event.args.tickLower);
    const tickUpper = bigIntify(event.args.tickUpper);
    pool.blockTimestamp = bigIntify(blockHeader.timestamp);

    try {
      // For state is relevant just to update the ticks and other things
      uniswapV3Math._modifyPosition(pool, {
        tickLower,
        tickUpper,
        liquidityDelta: amount,
      });
    } catch (e) {
      this.logger.error(
        'Unexpected error while handling Mint event for UniswapV3',
        e,
      );
      pool.isValid = false;
    }

    return pool;
  }

  handleSetFeeProtocolEvent(
    event: any,
    pool: PoolState,
    log: Log,
    blockHeader: BlockHeader,
  ) {
    const feeProtocol0 = bigIntify(event.args.feeProtocol0New);
    const feeProtocol1 = bigIntify(event.args.feeProtocol1New);
    pool.slot0.feeProtocol = feeProtocol0 + (feeProtocol1 << 4n);
    return pool;
  }

  handleIncreaseObservationCardinalityNextEvent(
    event: any,
    pool: PoolState,
    log: Log,
    blockHeader: BlockHeader,
  ) {
    pool.slot0.observationCardinalityNext = parseInt(
      event.args.observationCardinalityNextNew,
      10,
    );
    return pool;
  }

  private _raiseIfNotAllSucceeded(data: MultiCallV2Output[]) {
    data.forEach((d: MultiCallV2Output, i: number) => {
      if (!d.success) {
        // It will raise an error with required message
        this.stateMultiIface.decodeFunctionResult('getFullState', d.returnData);
      }
    });
  }

  // TODO: Remove if not used later
  // private _calcPopulatedTickIndexes(
  //   tickBitmaps: bigint[],
  //   tickSpacing: bigint,
  // ): bigint[] {
  //   return tickBitmaps.reduce<bigint[]>((acc, curr, tickBitmapIndex) => {
  //     if (curr !== 0n) {
  //       for (let i = 0n; i < 256n; i++) {
  //         if ((curr & (1n << i)) > 0n) {
  //           const populatedTick =
  //             ((BigInt(tickBitmapIndex) << 8n) + i) * tickSpacing;
  //           acc.push(populatedTick);
  //         }
  //       }
  //     }
  //     return acc;
  //   }, []);
  // }
}
