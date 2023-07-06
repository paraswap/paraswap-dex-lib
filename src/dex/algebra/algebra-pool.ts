import _ from 'lodash';
import { Interface } from '@ethersproject/abi';
import { DeepReadonly, assert } from 'ts-essentials';
import { Address, BlockHeader, Log, Logger, NumberAsString } from '../../types';
import { bigIntify, catchParseLogError } from '../../utils';
import {
  InitializeStateOptions,
  StatefulEventSubscriber,
} from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { PoolState } from './types';
import { ethers } from 'ethers';
import { Contract } from 'web3-eth-contract';
import AlgebraABI from '../../abi/algebra/AlgebraPool.abi.json';
import { DecodedStateMultiCallResultWithRelativeBitmaps } from '../uniswap-v3/types';
import {
  OUT_OF_RANGE_ERROR_POSTFIX,
  TICK_BITMAP_BUFFER,
  TICK_BITMAP_TO_USE,
} from '../uniswap-v3/constants';
import { uint256ToBigInt } from '../../lib/decoders';
import { MultiCallParams } from '../../lib/multi-wrapper';
import { decodeStateMultiCallResultWithRelativeBitmaps } from '../uniswap-v3/utils';
import { AlgebraMath } from './lib/AlgebraMath';
import { TickBitMap } from '../uniswap-v3/contract-math/TickBitMap';
import { TICK_SPACING } from './lib/Constants';
import {
  _reduceTickBitmap,
  _reduceTicks,
} from '../uniswap-v3/contract-math/utils';

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
          return this.handlers[event.name](event, _state, log, blockHeader);
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
                } for UniswapV3, ${JSON.stringify(event)}`,
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

  private _getStateRequestCallData() {
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

    return callData;
  }

  getBitmapRangeToRequest() {
    return TICK_BITMAP_TO_USE + TICK_BITMAP_BUFFER; // TODO: validate
  }

  async generateState(blockNumber: number): Promise<Readonly<PoolState>> {
    const callData = this._getStateRequestCallData();

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

    const tickBitmap = {};
    const ticks = {};

    _reduceTickBitmap(tickBitmap, _state.tickBitmap);
    _reduceTicks(ticks, _state.ticks);

    const globalState = {
      communityFeeToken0: 0n,
      communityFeeToken1: 0n,
      fee: 0n,
      price: 0n,
      tick: 0n,
      timepointIndex: 0n,
      unlocked: true,
    };

    const currentTick = globalState.tick;
    const startTickBitmap = TickBitMap.position(currentTick / TICK_SPACING)[0];

    return {
      // TODO FILL
      pool: _state.pool,
      blockTimestamp: 0n,
      timepoints: {},
      globalState,
      liquidity: bigIntify(_state.liquidity),
      tickSpacing: 0n,
      maxLiquidityPerTick: 0n,
      volumePerLiquidityInBlock: 0n,
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

      AlgebraMath.swapFromEvent(
        pool,
        newSqrtPriceX96,
        newTick,
        newLiquidity,
        zeroForOne,
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
    const liquidityActual = bigIntify(event.args.liquidityActual);
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
    const amount = bigIntify(event.args.amount);
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
    const communityFeeToken0 = bigIntify(event.ags.communityFeeToken0);
    const communityFeeToken1 = bigIntify(event.ags.communityFeeToken1);

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
