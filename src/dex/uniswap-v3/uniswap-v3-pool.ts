import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Log, Logger, BlockHeader, Token, Address } from '../../types';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { PoolState } from './types';
import UniswapV3RouterABI from '../../abi/uniswap-v3/UniswapV3Router.abi.json';
import { bigIntify, stringify, _require } from '../../utils';
import { FullMath } from './contract-math/FullMath';
import { FixedPoint128 } from './contract-math/FixedPoint128';
import { uniswapV3Math } from './contract-math/uniswap-v3-math';

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
    this.logDecoder = (log: Log) => this.uniswapV3Iface.parseLog(log);
    this.addressesSubscribed = [poolAddress];

    // Add handlers
    this.handlers['Swap'] = this.handleSwapEvent.bind(this);
    this.handlers['Burn'] = this.handleBurnEvent.bind(this);
    this.handlers['Mint'] = this.handleMintEvent.bind(this);
    this.handlers['Flash'] = this.handleFlashEvent.bind(this);
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
      feeGrowthGlobal0X128: 0n,
      feeGrowthGlobal1X128: 0n,
    };
  }

  handleSwapEvent(
    event: any,
    pool: PoolState,
    log: Log,
    blockHeader: BlockHeader,
  ) {
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

    // For state is relevant just to update the ticks and other things
    uniswapV3Math._modifyPosition(pool, {
      tickLower,
      tickUpper,
      liquidityDelta: -amount,
    });

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

    // For state is relevant just to update the ticks and other things
    uniswapV3Math._modifyPosition(pool, {
      tickLower,
      tickUpper,
      liquidityDelta: amount,
    });

    return pool;
  }

  handleFlashEvent(
    event: any,
    pool: PoolState,
    log: Log,
    blockHeader: BlockHeader,
  ) {
    const paid0 = bigIntify(event.args.paid0);
    const paid1 = bigIntify(event.args.paid1);

    if (paid0 > 0n) {
      const feeProtocol0 = pool.slot0.feeProtocol % 16n;
      const fees0 = feeProtocol0 === 0n ? 0n : paid0 / feeProtocol0;
      pool.feeGrowthGlobal0X128 += FullMath.mulDiv(
        paid0 - fees0,
        FixedPoint128.Q128,
        pool.liquidity,
      );
    }
    if (paid1 > 0n) {
      const feeProtocol1 = pool.slot0.feeProtocol >> 4n;
      const fees1 = feeProtocol1 == 0n ? 0n : paid1 / feeProtocol1;
      pool.feeGrowthGlobal1X128 += FullMath.mulDiv(
        paid1 - fees1,
        FixedPoint128.Q128,
        pool.liquidity,
      );
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
