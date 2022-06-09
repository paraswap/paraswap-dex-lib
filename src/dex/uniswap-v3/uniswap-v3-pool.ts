import _ from 'lodash';
import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import {
  Log,
  Logger,
  BlockHeader,
  Token,
  Address,
  MultiCallV2Output,
} from '../../types';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { OracleObservation, PoolState, Slot0, TickInfo } from './types';
import UniswapV3PoolABI from '../../abi/uniswap-v3/UniswapV3Pool.abi.json';
import { bigIntify } from '../../utils';
import { uniswapV3Math } from './contract-math/uniswap-v3-math';
import {
  TICK_BIT_MAP_CHUNK_SIZE,
  TICK_BIT_MAP_REQUEST_AMOUNT,
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

  private _encodedFirstStepStateCalldata?: {
    target: Address;
    callData: string;
  }[];

  constructor(
    protected parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    readonly poolAddress: Address,
    readonly feeCode: bigint,
    token0: Address,
    token1: Address,
    protected poolIface = new Interface(UniswapV3PoolABI),
  ) {
    super(`${parentName}_${token0}_${token1}_pool`, logger);
    this.poolAddress = poolAddress.toLowerCase();
    this.token0 = token0.toLowerCase();
    this.token1 = token1.toLowerCase();
    this.logDecoder = (log: Log) => this.poolIface.parseLog(log);
    this.addressesSubscribed = [poolAddress];

    // Add handlers
    this.handlers['Swap'] = this.handleSwapEvent.bind(this);
    this.handlers['Burn'] = this.handleBurnEvent.bind(this);
    this.handlers['Mint'] = this.handleMintEvent.bind(this);
    this.handlers['SetFeeProtocol'] = this.handleSetFeeProtocolEvent.bind(this);
    this.handlers['IncreaseObservationCardinalityNext'] =
      this.handleIncreaseObservationCardinalityNextEvent.bind(this);
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

  private _getFirstStepStateCallData() {
    const target = this.poolAddress;
    if (!this._encodedFirstStepStateCalldata) {
      const callData = [
        {
          target,
          callData: this.poolIface.encodeFunctionData('slot0', []),
        },
        {
          target,
          callData: this.poolIface.encodeFunctionData('liquidity', []),
        },
        {
          target,
          callData: this.poolIface.encodeFunctionData('fee', []),
        },
        {
          target,
          callData: this.poolIface.encodeFunctionData('tickSpacing', []),
        },
        {
          target,
          callData: this.poolIface.encodeFunctionData(
            'maxLiquidityPerTick',
            [],
          ),
        },
      ].concat(
        new Array(TICK_BIT_MAP_REQUEST_AMOUNT).fill(undefined).map((_0, i) => ({
          target,
          callData: this.poolIface.encodeFunctionData('tickBitmap', [i]),
        })),
      );

      this._encodedFirstStepStateCalldata = callData;
    }
    return this._encodedFirstStepStateCalldata;
  }

  private _getSecondStepStateCallData(
    observationIndex: number,
    ticks: bigint[],
  ) {
    if (ticks.length > 2000) {
      this.logger.error(
        `Error ${this.parentName} [_getSecondStepStateCallData]: tick.length=${ticks.length} is too bog. Consider batching multicall requests`,
      );
    }
    const target = this.poolAddress;
    return [
      {
        target,
        callData: this.poolIface.encodeFunctionData('observations', [
          observationIndex,
        ]),
      },
    ].concat(
      ticks.map(tick => ({
        target,
        callData: this.poolIface.encodeFunctionData('ticks', [tick]),
      })),
    );
  }

  async generateState(blockNumber: number): Promise<Readonly<PoolState>> {
    const firstCallData = this._getFirstStepStateCallData();

    const firstData = (
      await Promise.all(
        _.chunk(
          firstCallData,
          Math.floor(
            // Because callData has other entries than tickBitmap, real chunk
            // size by one bigger than this value, so I reduce by one TICK_BIT_MAP_CHUNK_SIZE - 1
            TICK_BIT_MAP_REQUEST_AMOUNT / (TICK_BIT_MAP_CHUNK_SIZE - 1),
          ),
        ).map(async chunkedCallData =>
          this.dexHelper.multiContract.methods
            .tryAggregate(false, chunkedCallData)
            .call({}, blockNumber || 'latest'),
        ),
      )
    ).flat();

    this._checkMulticallResultForError(firstData, blockNumber);

    const slot0 = this._decodeSlot0Result(firstData[0].returnData);
    const liquidity = bigIntify(
      this.poolIface.decodeFunctionResult(
        'liquidity',
        firstData[1].returnData,
      )[0],
    );
    const fee = bigIntify(
      this.poolIface.decodeFunctionResult('fee', firstData[2].returnData)[0],
    );
    const tickSpacing = bigIntify(
      this.poolIface.decodeFunctionResult(
        'tickSpacing',
        firstData[3].returnData,
      )[0],
    );
    const maxLiquidityPerTick = bigIntify(
      this.poolIface.decodeFunctionResult(
        'maxLiquidityPerTick',
        firstData[4].returnData,
      )[0],
    );

    const tickBitmap = firstData
      .slice(5)
      .map((d: MultiCallV2Output) =>
        bigIntify(
          this.poolIface.decodeFunctionResult('tickBitmap', d.returnData)[0],
        ),
      )
      .reduce<Record<string, bigint>>((acc, curr, i) => {
        acc[i.toString()] = curr;
        return acc;
      }, {});

    const populatedTickIndexes = this._calcPopulatedTickIndexes(
      Object.values(tickBitmap),
      tickSpacing,
    );

    const observations = new Array(65535);

    const secondCallData = this._getSecondStepStateCallData(
      slot0.observationIndex,
      populatedTickIndexes,
    );

    const secondData = await this.dexHelper.multiContract.methods
      .tryAggregate(false, secondCallData)
      .call({}, blockNumber || 'latest');

    this._checkMulticallResultForError(secondData, blockNumber);

    observations[slot0.observationIndex] = this._decodeObservationResult(
      secondData[0].returnData,
    );

    const ticks = populatedTickIndexes.reduce<Record<string, TickInfo>>(
      (acc, curr, i) => {
        acc[curr.toString()] = this._decodeTickInfoResult(
          secondData[i + 1].returnData,
        );
        return acc;
      },
      {},
    );

    return {
      // Later before parsing new event, it will be replaced with blockTimestamp
      // It doesn't affect the pricing
      blockTimestamp: BigInt(Date.now()) / 1000n,
      slot0,
      liquidity,
      fee,
      tickSpacing,
      maxLiquidityPerTick,
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
      // For state is relevant just to update the ticks and other things
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

  private _decodeSlot0Result(data: string): Slot0 {
    const _slot0 = this.poolIface.decodeFunctionResult('slot0', data);
    return {
      sqrtPriceX96: bigIntify(_slot0.sqrtPriceX96),
      tick: bigIntify(_slot0.tick),
      observationIndex: _slot0.observationIndex,
      observationCardinality: _slot0.observationCardinality,
      observationCardinalityNext: _slot0.observationCardinalityNext,
      feeProtocol: bigIntify(_slot0.feeProtocol),
    };
  }

  private _decodeObservationResult(data: string): OracleObservation {
    const observation = this.poolIface.decodeFunctionResult(
      'observations',
      data,
    );
    return {
      blockTimestamp: bigIntify(observation.blockTimestamp),
      tickCumulative: bigIntify(observation.tickCumulative),
      secondsPerLiquidityCumulativeX128: bigIntify(
        observation.secondsPerLiquidityCumulativeX128,
      ),
      initialized: observation.initialized,
    };
  }

  private _decodeTickInfoResult(data: string): TickInfo {
    const tickInfo = this.poolIface.decodeFunctionResult('ticks', data);
    return {
      liquidityGross: bigIntify(tickInfo.liquidityGross),
      liquidityNet: bigIntify(tickInfo.liquidityNet),
      tickCumulativeOutside: bigIntify(tickInfo.tickCumulativeOutside),
      secondsPerLiquidityOutsideX128: bigIntify(
        tickInfo.secondsPerLiquidityOutsideX128,
      ),
      secondsOutside: bigIntify(tickInfo.secondsOutside),
      initialized: tickInfo.initialized,
    };
  }

  private _calcPopulatedTickIndexes(
    tickBitmaps: bigint[],
    tickSpacing: bigint,
  ): bigint[] {
    return tickBitmaps.reduce<bigint[]>((acc, curr, tickBitmapIndex) => {
      if (curr !== 0n) {
        for (let i = 0n; i < 256n; i++) {
          if ((curr & (1n << i)) > 0n) {
            const populatedTick =
              ((BigInt(tickBitmapIndex) << 8n) + i) * tickSpacing;
            acc.push(populatedTick);
          }
        }
      }
      return acc;
    }, []);
  }

  private _checkMulticallResultForError(
    data: MultiCallV2Output[],
    blockNumber: number,
  ) {
    data.forEach((d: MultiCallV2Output, i: number) => {
      if (!d.success) {
        throw new Error(
          `${this.parentName}: Can not fetch state for ${blockNumber} and index=${i}`,
        );
      }
    });
  }
}
