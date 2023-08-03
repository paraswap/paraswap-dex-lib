import _ from 'lodash';
import { Interface } from '@ethersproject/abi';
import { DeepReadonly, assert } from 'ts-essentials';
import { Address, BlockHeader, Log, Logger } from '../../types';
import { bigIntify, catchParseLogError, int16 } from '../../utils';
import {
  InitializeStateOptions,
  StatefulEventSubscriber,
} from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  PoolState,
  TickBitMapMappingsWithBigNumber,
  TickInfoMappingsWithBigNumber,
} from './types';
import { ethers } from 'ethers';
import { Contract } from 'web3-eth-contract';
import AlgebraABI from '../../abi/algebra/AlgebraPool.abi.json';
import { DecodedStateMultiCallResultWithRelativeBitmaps } from './types';
import {
  OUT_OF_RANGE_ERROR_POSTFIX,
  TICK_BITMAP_BUFFER,
  TICK_BITMAP_TO_USE,
} from '../uniswap-v3/constants';
import { uint256ToBigInt } from '../../lib/decoders';
import { MultiCallParams } from '../../lib/multi-wrapper';
import { decodeStateMultiCallResultWithRelativeBitmaps } from './utils';
import { AlgebraMath } from './lib/AlgebraMath';
import { TickBitMap } from '../uniswap-v3/contract-math/TickBitMap';
import {
  _reduceTickBitmap,
  _reduceTicks,
} from '../uniswap-v3/contract-math/utils';
import { Constants } from './lib/Constants';
import { Network } from '../../constants';

export class AlgebraEventPool extends StatefulEventSubscriber<PoolState> {
  handlers: {
    [event: string]: (
      event: any,
      state: DeepReadonly<PoolState>,
      log: Readonly<Log>,
      blockHeader: BlockHeader,
    ) => DeepReadonly<PoolState> | null;
  } = {};

  logDecoder: (log: Log) => any;

  addressesSubscribed: string[];

  private _poolAddress?: Address;
  readonly token0: Address;
  readonly token1: Address;

  public readonly poolIface = new Interface(AlgebraABI);

  public initFailed = false;
  public initRetryAttemptCount = 0;

  constructor(
    readonly dexHelper: IDexHelper,
    parentName: string,
    readonly stateMultiContract: Contract,
    readonly erc20Interface: Interface,
    protected readonly factoryAddress: Address,
    token0: Address,
    token1: Address,
    logger: Logger,
    mapKey: string = '',
    readonly poolInitCodeHash: string,
    readonly poolDeployer: string,
  ) {
    super(parentName, `${token0}_${token1}`, dexHelper, logger, true, mapKey);
    this.token0 = token0.toLowerCase();
    this.token1 = token1.toLowerCase();

    this.logDecoder = (log: Log) => this.poolIface.parseLog(log);
    this.addressesSubscribed = new Array<Address>(1);

    this.handlers['Fee'] = this.handleNewFee.bind(this);
    this.handlers['Swap'] = this.handleSwapEvent.bind(this);
    this.handlers['Mint'] = this.handleMintEvent.bind(this);
    this.handlers['Burn'] = this.handleBurnEvent.bind(this);
    this.handlers['Flash'] = this.handleFlashEvent.bind(this);
    this.handlers['Collect'] = this.handleCollectEvent.bind(this);
    this.handlers['CommunityFee'] = this.handleCommunityFee.bind(this);
  }

  get poolAddress() {
    if (this._poolAddress === undefined) {
      this._poolAddress = this._computePoolAddress(this.token0, this.token1);
    }
    return this._poolAddress;
  }

  set poolAddress(address: Address) {
    this._poolAddress = address.toLowerCase();
  }

  async initialize(
    blockNumber: number,
    options?: InitializeStateOptions<PoolState>,
  ) {
    await super.initialize(blockNumber, options);
  }

  protected async processBlockLogs(
    state: DeepReadonly<PoolState>,
    logs: Readonly<Log>[],
    blockHeader: Readonly<BlockHeader>,
  ): Promise<DeepReadonly<PoolState> | null> {
    const newState = await super.processBlockLogs(state, logs, blockHeader);
    if (newState && !newState.isValid) {
      return await this.generateState(blockHeader.number);
    }
    return newState;
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
        const _state = _.cloneDeep(state) as PoolState;
        try {
          const newState = this.handlers[event.name](
            event,
            _state,
            log,
            blockHeader,
          );
          return newState;
        } catch (e) {
          if (
            e instanceof Error &&
            e.message.endsWith(OUT_OF_RANGE_ERROR_POSTFIX)
          ) {
            this.logger.warn(
              `${this.parentName}: Pool ${this.poolAddress} on ${
                this.dexHelper.config.data.network
              } is out of TickBitmap requested range. Re-query the state. ${JSON.stringify(
                event,
              )}`,
              e,
            );
          } else {
            this.logger.error(
              `${this.parentName}: Pool ${this.poolAddress}, ` +
                `network=${this.dexHelper.config.data.network}: Unexpected ` +
                `error while handling event on blockNumber=${blockHeader.number}, ` +
                `blockHash=${blockHeader.hash} and parentHash=${
                  blockHeader.parentHash
                } for QuickSwapV3, ${JSON.stringify(event)}`,
              e,
            );
          }
          _state.isValid = false;
          return _state;
        }
      }
    } catch (e) {
      catchParseLogError(e, this.logger);
    }
    return null; // ignore unrecognized event
  }

  getBitmapRangeToRequest() {
    return TICK_BITMAP_TO_USE + TICK_BITMAP_BUFFER;
  }

  private async _fetchPoolStateSingleStep(
    blockNumber: number,
  ): Promise<[bigint, bigint, DecodedStateMultiCallResultWithRelativeBitmaps]> {
    const callData: MultiCallParams<
      bigint | DecodedStateMultiCallResultWithRelativeBitmaps
    >[] = [
      {
        target: this.token0,
        callData: this.erc20Interface.encodeFunctionData('balanceOf', [
          this.poolAddress,
        ]),
        decodeFunction: uint256ToBigInt,
      },
      {
        target: this.token1,
        callData: this.erc20Interface.encodeFunctionData('balanceOf', [
          this.poolAddress,
        ]),
        decodeFunction: uint256ToBigInt,
      },
      {
        target: this.stateMultiContract.options.address,
        callData: this.stateMultiContract.methods
          .getFullStateWithRelativeBitmaps(
            this.factoryAddress,
            this.token0,
            this.token1,
            this.getBitmapRangeToRequest(),
            this.getBitmapRangeToRequest(),
          )
          .encodeABI(),
        decodeFunction: decodeStateMultiCallResultWithRelativeBitmaps,
      },
    ];

    const [resBalance0, resBalance1, resState] =
      await this.dexHelper.multiWrapper.tryAggregate<
        bigint | DecodedStateMultiCallResultWithRelativeBitmaps
      >(
        false,
        callData,
        blockNumber,
        this.dexHelper.multiWrapper.defaultBatchSize,
        false,
      );

    assert(resState.success, 'Pool does not exist');

    const [balance0, balance1, _state] = [
      resBalance0.returnData,
      resBalance1.returnData,
      resState.returnData,
    ] as [bigint, bigint, DecodedStateMultiCallResultWithRelativeBitmaps];

    return [balance0, balance1, _state];
  }

  private async _fetchPoolStateMultiStep(
    blockNumber: number,
  ): Promise<[bigint, bigint, DecodedStateMultiCallResultWithRelativeBitmaps]> {
    const balancesAndGlobalStateCalldata: MultiCallParams<
      bigint | DecodedStateMultiCallResultWithRelativeBitmaps
    >[] = [
      {
        target: this.token0,
        callData: this.erc20Interface.encodeFunctionData('balanceOf', [
          this.poolAddress,
        ]),
        decodeFunction: uint256ToBigInt,
      },
      {
        target: this.token1,
        callData: this.erc20Interface.encodeFunctionData('balanceOf', [
          this.poolAddress,
        ]),
        decodeFunction: uint256ToBigInt,
      },
      {
        target: this.stateMultiContract.options.address,
        callData: this.stateMultiContract.methods
          .getFullStateWithoutTicks(
            this.factoryAddress,
            this.token0,
            this.token1,
            0,
            0,
          )
          .encodeABI(),
        decodeFunction: decodeStateMultiCallResultWithRelativeBitmaps,
      },
    ];

    const [resBalance0, resBalance1, stateWithoutTicksAndTickBitmap] =
      await this.dexHelper.multiWrapper.tryAggregate<
        bigint | DecodedStateMultiCallResultWithRelativeBitmaps
      >(
        false,
        balancesAndGlobalStateCalldata,
        blockNumber,
        this.dexHelper.multiWrapper.defaultBatchSize,
        false,
      );

    assert(stateWithoutTicksAndTickBitmap.success, 'Pool does not exist');

    const [balance0, balance1, _stateWithoutTicksAndTickBitmap] = [
      resBalance0.returnData,
      resBalance1.returnData,
      stateWithoutTicksAndTickBitmap.returnData,
    ] as [bigint, bigint, DecodedStateMultiCallResultWithRelativeBitmaps];

    const {
      globalState: { tick },
    } = _stateWithoutTicksAndTickBitmap;
    const currentBitmapIndex = int16(
      (BigInt(tick) / Constants.TICK_SPACING) >> 8n,
    );

    const buffer = this.getBitmapRangeToRequest();
    const startBitMapIndex = currentBitmapIndex - buffer;
    const endBitMapIndex = currentBitmapIndex + buffer;
    const allBitMapIndices = Array.from(
      { length: 2 * Number(buffer) + 1 },
      () => startBitMapIndex + endBitMapIndex,
    );

    const ticksAndBitMaps = await Promise.all(
      allBitMapIndices.map(relativeTick => {
        return this.stateMultiContract.methods
          .getAdditionalBitmapWithTicks(
            this.factoryAddress,
            this.token0,
            this.token1,
            relativeTick,
            relativeTick,
          )
          .call() as [
          TickBitMapMappingsWithBigNumber[],
          TickInfoMappingsWithBigNumber[],
        ];
      }),
    );

    const _state: DecodedStateMultiCallResultWithRelativeBitmaps = {
      ..._stateWithoutTicksAndTickBitmap,
      tickBitmap: ticksAndBitMaps.flatMap(v => v[0]),
      ticks: ticksAndBitMaps.flatMap(v => v[1]),
    };

    return [balance0, balance1, _state];
  }

  async _fetchInitStateMultiStrategies(
    blockNumber: number,
  ): Promise<[bigint, bigint, DecodedStateMultiCallResultWithRelativeBitmaps]> {
    try {
      return await this._fetchPoolStateSingleStep(blockNumber);
    } catch (e) {
      if (e instanceof Error && e.message.includes('Pool does not exist'))
        throw e;

      if (this.dexHelper.config.data.network != Network.ZKEVM) throw e;

      return this._fetchPoolStateMultiStep(blockNumber);
    }
  }

  async generateState(blockNumber: number): Promise<Readonly<PoolState>> {
    const [balance0, balance1, _state] =
      await this._fetchInitStateMultiStrategies(blockNumber);

    const tickBitmap = {};
    const ticks = {};

    _reduceTickBitmap(tickBitmap, _state.tickBitmap);
    _reduceTicks(ticks, _state.ticks);
    const globalState: PoolState['globalState'] = {
      communityFeeToken0: bigIntify(_state.globalState.communityFeeToken0),
      communityFeeToken1: bigIntify(_state.globalState.communityFeeToken1),
      fee: bigIntify(_state.globalState.fee),
      price: bigIntify(_state.globalState.price),
      tick: bigIntify(_state.globalState.tick),
    };
    const currentTick = globalState.tick;
    const startTickBitmap = TickBitMap.position(
      BigInt(currentTick) / Constants.TICK_SPACING,
    )[0];

    return {
      pool: _state.pool,
      blockTimestamp: bigIntify(_state.blockTimestamp),
      globalState,
      liquidity: bigIntify(_state.liquidity),
      tickSpacing: Constants.TICK_SPACING,
      maxLiquidityPerTick: Constants.MAX_LIQUIDITY_PER_TICK,
      tickBitmap,
      ticks,
      startTickBitmap,
      isValid: true,
      balance0,
      balance1,
    };
  }

  handleSwapEvent(
    event: any,
    pool: PoolState,
    log: Log,
    blockHeader: BlockHeader,
  ) {
    const newSqrtPriceX96 = bigIntify(event.args.price);
    const amount0 = bigIntify(event.args.amount0);
    const amount1 = bigIntify(event.args.amount1);
    const newTick = bigIntify(event.args.tick);
    const newLiquidity = bigIntify(event.args.liquidity);
    pool.blockTimestamp = bigIntify(blockHeader.timestamp);

    if (amount0 <= 0n && amount1 <= 0n) {
      this.logger.error(
        `${this.parentName}: amount0 <= 0n && amount1 <= 0n for ` +
          `${this.poolAddress} and ${blockHeader.number}. Check why it happened`,
      );
      pool.isValid = false;
      return pool;
    } else {
      const zeroForOne = amount0 > 0n;

      const [, , , , , communityFee] = AlgebraMath._calculateSwapAndLock(
        pool,
        zeroForOne,
        newSqrtPriceX96,
        newTick,
        newLiquidity,
      );

      if (zeroForOne) {
        if (amount1 < 0n) {
          pool.balance1 -= BigInt.asUintN(256, -amount1);
        } else {
          this.logger.error(
            `In swapEvent for pool ${pool.pool} received incorrect values ${zeroForOne} and ${amount1}`,
          );
          pool.isValid = false;
        }
        // This is not correct fully, because pool may get more tokens then it needs, but
        // it is not accounted in internal state, it should be good enough
        pool.balance0 += BigInt.asUintN(256, amount0);
      } else {
        if (amount0 < 0n) {
          pool.balance0 -= BigInt.asUintN(256, -amount0);
        } else {
          this.logger.error(
            `In swapEvent for pool ${pool.pool} received incorrect values ${zeroForOne} and ${amount0}`,
          );
          pool.isValid = false;
        }
        pool.balance1 += BigInt.asUintN(256, amount1);
      }

      if (communityFee > 0n) {
        // _payCommunityFee
        if (zeroForOne) {
          pool.balance0 -= communityFee;
        } else {
          pool.balance1 -= communityFee;
        }
      }

      return pool;
    }
  }
  handleMintEvent(
    event: any,
    pool: PoolState,
    log: Log,
    blockHeader: BlockHeader,
  ) {
    const bottomTick = bigIntify(event.args.bottomTick);
    const topTick = bigIntify(event.args.topTick);
    const liquidityActual = bigIntify(event.args.liquidityAmount);
    const amount0 = bigIntify(event.args.amount0);
    const amount1 = bigIntify(event.args.amount1);
    pool.blockTimestamp = bigIntify(blockHeader.timestamp);

    AlgebraMath._updatePositionTicksAndFees(
      pool,
      bottomTick,
      topTick,
      liquidityActual,
    );

    pool.balance0 += amount0;
    pool.balance1 += amount1;

    return pool;
  }

  handleBurnEvent(
    event: any,
    pool: PoolState,
    log: Log,
    blockHeader: BlockHeader,
  ) {
    const bottomTick = bigIntify(event.args.bottomTick);
    const topTick = bigIntify(event.args.topTick);
    const amount = bigIntify(event.args.liquidityAmount);
    pool.blockTimestamp = bigIntify(blockHeader.timestamp);

    AlgebraMath._updatePositionTicksAndFees(
      pool,
      bottomTick,
      topTick,
      -BigInt.asIntN(128, BigInt.asIntN(256, amount)),
    );

    // no balance change

    return pool;
  }

  handleNewFee(
    event: any,
    pool: PoolState,
    log: Log,
    blockHeader: BlockHeader,
  ) {
    const fee = bigIntify(event.args.fee);

    pool.globalState.fee = fee;
    pool.blockTimestamp = bigIntify(blockHeader.timestamp);

    return pool;
  }

  handleCollectEvent(
    event: any,
    pool: PoolState,
    log: Log,
    blockHeader: BlockHeader,
  ) {
    const amount0 = bigIntify(event.args.amount0);
    const amount1 = bigIntify(event.args.amount1);
    pool.balance0 -= amount0;
    pool.balance1 -= amount1;
    pool.blockTimestamp = bigIntify(blockHeader.timestamp);

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
    pool.balance0 += paid0;
    pool.balance1 += paid1;
    pool.blockTimestamp = bigIntify(blockHeader.timestamp);

    return pool;
  }

  handleCommunityFee(
    event: any,
    pool: PoolState,
    log: Log,
    blockHeader: BlockHeader,
  ) {
    const communityFeeToken0 = bigIntify(event.ags.communityFee0New);
    const communityFeeToken1 = bigIntify(event.ags.communityFee1New);

    pool.globalState.communityFeeToken0 = communityFeeToken0;
    pool.globalState.communityFeeToken1 = communityFeeToken1;

    pool.blockTimestamp = bigIntify(blockHeader.timestamp);

    return pool;
  }

  private _computePoolAddress(token0: Address, token1: Address): Address {
    // https://github.com/Uniswap/v3-periphery/blob/main/contracts/libraries/PoolAddress.sol
    if (token0 > token1) [token0, token1] = [token1, token0];

    const encodedKey = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ['address', 'address'],
        [token0, token1],
      ),
    );

    return ethers.utils.getCreate2Address(
      this.poolDeployer,
      encodedKey,
      this.poolInitCodeHash,
    );
  }
}
