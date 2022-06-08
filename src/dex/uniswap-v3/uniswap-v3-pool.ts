import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Log, Logger, BlockHeader, Token, Address } from '../../types';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { PoolState } from './types';
import UniswapV3RouterABI from '../../abi/uniswap-v3/UniswapV3Router.abi.json';
import { bigIntify } from '../../utils';
import { uniswapV3Math } from './contract-math/uniswap-v3-math';
import { TICK_BIT_MAP_REQUEST_AMOUNT } from './constants';

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

  private _encodedFirstStepStateCalldata?: {
    target: Address;
    callData: string;
  }[];

  constructor(
    protected parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    protected uniswapV3Iface = new Interface(UniswapV3RouterABI),
    private readonly poolAddress: Address,
    private readonly token0: Token,
    private readonly token1: Token,
    private readonly feeCode: number,
  ) {
    super(
      `${parentName}_${token0.symbol || token0.address}_${
        token1.symbol || token1.address
      }_pool`,
      logger,
    );
    this.poolAddress = poolAddress.toLowerCase();
    this.logDecoder = (log: Log) => this.uniswapV3Iface.parseLog(log);
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
          callData: this.uniswapV3Iface.encodeFunctionData('slot0', []),
        },
        {
          target,
          callData: this.uniswapV3Iface.encodeFunctionData('liquidity', []),
        },
        {
          target,
          callData: this.uniswapV3Iface.encodeFunctionData('fee', []),
        },
        {
          target,
          callData: this.uniswapV3Iface.encodeFunctionData('tickSpacing', []),
        },
        {
          target,
          callData: this.uniswapV3Iface.encodeFunctionData(
            'maxLiquidityPerTick',
            [],
          ),
        },
      ].concat(
        new Array(TICK_BIT_MAP_REQUEST_AMOUNT).fill(undefined).map((_0, i) => ({
          target,
          callData: this.uniswapV3Iface.encodeFunctionData('tickBitMap', [i]),
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
    if (ticks.length > 100) {
      this.logger.error(
        `Error ${this.parentName} [_getSecondStepStateCallData]: tick.length=${ticks.length} is too bog. Consider batching multicall requests`,
      );
    }
    const target = this.poolAddress;
    return [
      {
        target,
        callData: this.uniswapV3Iface.encodeFunctionData('observations', []),
      },
    ].concat(
      new Array(ticks.length).fill(undefined).map(tick => ({
        target,
        callData: this.uniswapV3Iface.encodeFunctionData('ticks', [tick]),
      })),
    );
  }

  async generateState(blockNumber: number): Promise<Readonly<PoolState>> {
    const callData = this._getFirstStepStateCallData();

    const data = await this.dexHelper.multiContract.methods
      .tryAggregate(false, callData)
      .call({}, blockNumber || 'latest');

    // const [
    //   slot0,
    //   liquidity,
    //   fee,
    //   tickSpacing,
    //   maxLiquidityPerTick,
    //   tickBitMaps,
    // ] = data.map(data: [boolean, any] => data);

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
      maxLiquidityPerTick: 0n,
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
}
