import _ from 'lodash';
import { Contract } from 'web3-eth-contract';
import { AbiItem } from 'web3-utils';
import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Log, Logger, BlockHeader, Address } from '../../types';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  PoolState,
  TickBitMapMappings,
  TickInfo,
  TickInfoMappings,
} from './types';
import UniswapV3PoolABI from '../../abi/uniswap-v3/UniswapV3Pool.abi.json';
import UniswapV3StateMulticallABI from '../../abi/uniswap-v3/UniswapV3StateMulticall.abi.json';
import { bigIntify } from '../../utils';
import { uniswapV3Math } from './contract-math/uniswap-v3-math';
import { NumberAsString } from 'paraswap-core';
import {
  OUT_OF_RANGE_ERROR_POSTFIX,
  TICK_BITMAP_BUFFER,
  TICK_BITMAP_TO_USE,
} from './constants';
import { TickBitMap } from './contract-math/TickBitMap';

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

  readonly stateMultiContract: Contract;

  private _stateRequestCallData?: {
    funcName: string;
    params: unknown[];
  };

  constructor(
    protected parentName: string,
    protected network: number,
    readonly dexHelper: IDexHelper,
    logger: Logger,
    stateMultiAddress: Address,
    protected readonly factoryAddress: Address,
    readonly feeCode: bigint,
    token0: Address,
    token1: Address,
    readonly poolIface = new Interface(UniswapV3PoolABI),
  ) {
    super(`${parentName}_${token0}_${token1}_pool`, logger);
    this.token0 = token0.toLowerCase();
    this.token1 = token1.toLowerCase();
    this.logDecoder = (log: Log) => this.poolIface.parseLog(log);
    this.addressesSubscribed = new Array<Address>(1);

    this.stateMultiContract = new this.dexHelper.web3Provider.eth.Contract(
      UniswapV3StateMulticallABI as AbiItem[],
      stateMultiAddress,
    );

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

  set poolAddress(address: Address) {
    this._poolAddress = address;
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
    if (!this._stateRequestCallData) {
      const callData = {
        funcName: 'getFullStateWithRelativeBitmaps',
        params: [
          this.factoryAddress,
          this.token0,
          this.token1,
          this.feeCode,
          TICK_BITMAP_TO_USE + TICK_BITMAP_BUFFER,
          TICK_BITMAP_TO_USE + TICK_BITMAP_BUFFER,
        ],
      };
      this._stateRequestCallData = callData;
    }
    return this._stateRequestCallData;
  }

  async generateState(blockNumber: number): Promise<Readonly<PoolState>> {
    const callData = this._getStateRequestCallData();

    const results = await this.stateMultiContract.methods[callData.funcName](
      ...callData.params,
    ).call({}, blockNumber || 'latest');

    const _state = results;

    const tickBitmap = {};
    const ticks = {};

    this._reduceTickBitmap(tickBitmap, _state.tickBitmap);
    this._reduceTicks(ticks, _state.ticks);

    // Not really a good place to do it, but in order to save RPC requests,
    // put it here
    this.poolAddress = _state.pool.toLowerCase();
    this.addressesSubscribed[0] = this.poolAddress;

    const observations = {
      [_state.slot0.observationIndex]: {
        blockTimestamp: bigIntify(_state.observation.blockTimestamp),
        tickCumulative: bigIntify(_state.observation.tickCumulative),
        secondsPerLiquidityCumulativeX128: bigIntify(
          _state.observation.secondsPerLiquidityCumulativeX128,
        ),
        initialized: _state.observation.initialized,
      },
    };

    const currentTick = bigIntify(_state.slot0.tick);
    const tickSpacing = bigIntify(_state.tickSpacing);

    return {
      blockTimestamp: bigIntify(_state.blockTimestamp),
      slot0: {
        sqrtPriceX96: bigIntify(_state.slot0.sqrtPriceX96),
        tick: currentTick,
        observationIndex: _state.slot0.observationIndex,
        observationCardinality: _state.slot0.observationCardinality,
        observationCardinalityNext: _state.slot0.observationCardinalityNext,
        feeProtocol: bigIntify(_state.slot0.feeProtocol),
      },
      liquidity: bigIntify(_state.liquidity),
      fee: this.feeCode,
      tickSpacing,
      maxLiquidityPerTick: bigIntify(_state.maxLiquidityPerTick),
      tickBitmap,
      ticks,
      observations,
      isValid: true,
      startTickBitmap: TickBitMap.position(currentTick / tickSpacing)[0],
    };
  }

  handleSwapEvent(
    event: any,
    pool: PoolState,
    log: Log,
    blockHeader: BlockHeader,
  ) {
    const newSqrtPriceX96 = bigIntify(event.args.sqrtPriceX96);
    const amount0 = bigIntify(event.args.amount0);
    const newTick = bigIntify(event.args.tick);
    const newLiquidity = bigIntify(event.args.liquidity);
    pool.blockTimestamp = bigIntify(blockHeader.timestamp);

    if (amount0 === 0n) {
      this.logger.error(
        `${this.parentName}: amount0 === 0n for ${this.poolAddress} and ${blockHeader.number}. Check why it happened`,
      );
      pool.isValid = false;
      return pool;
    } else {
      const zeroForOne = amount0 > 0n;

      return this._callAndHandleError(
        // I had strange TS compiler issue, so have to write it this way
        () =>
          uniswapV3Math.swapFromEvent(
            pool,
            newSqrtPriceX96,
            newTick,
            newLiquidity,
            zeroForOne,
          ),
        pool,
      );
    }
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

    return this._callAndHandleError(
      uniswapV3Math._modifyPosition.bind(uniswapV3Math, pool, {
        tickLower,
        tickUpper,
        liquidityDelta: -BigInt.asIntN(128, BigInt.asIntN(256, amount)),
      }),
      pool,
    );
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

    return this._callAndHandleError(
      uniswapV3Math._modifyPosition.bind(uniswapV3Math, pool, {
        tickLower,
        tickUpper,
        liquidityDelta: amount,
      }),
      pool,
    );
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
    pool.blockTimestamp = bigIntify(blockHeader.timestamp);

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
    pool.blockTimestamp = bigIntify(blockHeader.timestamp);
    return pool;
  }

  private _reduceTickBitmap(
    tickBitmap: Record<NumberAsString, bigint>,
    tickBitmapToReduce: TickBitMapMappings[],
  ) {
    return tickBitmapToReduce.reduce<Record<NumberAsString, bigint>>(
      (acc, curr) => {
        const { index, value } = curr;
        acc[index] = bigIntify(value);
        return acc;
      },
      tickBitmap,
    );
  }

  private _reduceTicks(
    ticks: Record<NumberAsString, TickInfo>,
    ticksToReduce: TickInfoMappings[],
  ) {
    return ticksToReduce.reduce<Record<string, TickInfo>>((acc, curr) => {
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
    }, ticks);
  }

  private _callAndHandleError(func: Function, pool: PoolState) {
    try {
      func();
    } catch (e) {
      if (
        e instanceof Error &&
        e.message.endsWith(OUT_OF_RANGE_ERROR_POSTFIX)
      ) {
        this.logger.trace(
          `${this.parentName}: Pool ${this.poolAddress} on network ${this.network} is out of TickBitmap requested range. Re-query the state`,
          e,
        );
      } else {
        this.logger.error(
          'Unexpected error while handling event for UniswapV3',
          e,
        );
      }
      pool.isValid = false;
    }
    return pool;
  }
}
