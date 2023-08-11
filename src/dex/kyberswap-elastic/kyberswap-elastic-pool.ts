import _ from 'lodash';
import { Interface } from '@ethersproject/abi';
import { NumberAsString } from '@paraswap/core';
import { BytesLike, ethers } from 'ethers';
import { AbiItem } from 'web3-utils';
import { Contract } from 'web3-eth-contract';
import { assert, DeepReadonly } from 'ts-essentials';

import { Log, Logger, Address, BlockHeader } from '../../types';
import { bigIntify, catchParseLogError } from '../../utils';
import { generateConfig } from '../../config';
import { ERC20EventSubscriber } from '../../lib/generics-events-subscribers/erc20-event-subscriber';
import {
  StatefulEventSubscriber,
  InitializeStateOptions,
} from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { BI_MAX_UINT128 } from '../../bigint-constants';
import { getERC20Subscriber } from '../../lib/generics-events-subscribers/erc20-event-subscriber-factory';
import { generalDecoder, uint256ToBigInt } from '../../lib/decoders';

import ERC20ABI from '../../abi/erc20.json';
import MultiCallABI from '../../abi/multi-v2.json';
import PoolABI from '../../abi/kyberswap-elastic/IPool.json';
import TicksFeesReaderABI from '../../abi/kyberswap-elastic/TicksFeesReader.json';

import { KyberswapElasticConfig, TICK_DISTANCE } from './config';
import {
  PoolState,
  TickInfo,
  PoolData,
  KyberElasticStateResponses,
  PoolStateResponse,
  LiquidityStateResponse,
  FeeGrowthGlobalResponse,
  SecondsPerLiquidityResponse,
  LinkedlistData,
  InitializedTicksResponse,
  TicksResponse,
} from './types';
import { TickMath } from './contract-math/TickMath';
import { ksElasticMath } from './contract-math/kyberswap-elastic-math';
import { MultiCallParams, MultiResult } from '../../lib/multi-wrapper';
import {
  decodeInitializedTicks,
  decodeLiquidityState,
  decodePoolState,
  decodeSecondsPerLiquidity,
  decodeTicks,
} from './utils/decoders';
import { ERR_POOL_DOES_NOT_EXIST } from './errors';

export class KyberswapElasticEventPool extends StatefulEventSubscriber<PoolState> {
  handlers: {
    [event: string]: (
      event: any,
      pool: PoolState,
      log: Log,
      blockHeader: Readonly<BlockHeader>,
    ) => PoolState;
  } = {};

  logDecoder: (log: Log) => any;

  public addressesSubscribed: string[];

  public poolContract: Contract;

  readonly erc20Iface = new Interface(ERC20ABI);
  readonly kyberswapElasticIface = new Interface(PoolABI);

  readonly multicallContract: Contract;
  readonly ticksFeesReaderContract: Contract;

  private _poolAddress?: Address;
  private _stateRequestCallData?: MultiCallParams<KyberElasticStateResponses>[];

  constructor(
    readonly parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    protected logger: Logger,
    protected config = KyberswapElasticConfig[parentName][network],
    readonly swapFeeUnits: bigint,
    readonly token0: Address,
    readonly token1: Address,
  ) {
    super(parentName, `${token0}_${token1}_${swapFeeUnits}`, dexHelper, logger);

    this.logDecoder = (log: Log) => this.kyberswapElasticIface.parseLog(log);
    this.addressesSubscribed = new Array<Address>(1);

    this.token0 = token0.toLowerCase();
    this.token1 = token1.toLowerCase();

    // Initialize contract instances
    this.poolContract = new this.dexHelper.web3Provider.eth.Contract(
      PoolABI as AbiItem[],
      this.poolAddress,
    );

    this.multicallContract = new this.dexHelper.web3Provider.eth.Contract(
      MultiCallABI as AbiItem[],
      this.dexHelper.config.data.multicallV2Address,
    );

    this.ticksFeesReaderContract = new this.dexHelper.web3Provider.eth.Contract(
      TicksFeesReaderABI as AbiItem[],
      config.ticksFeesReader,
    );

    // Event handlers
    this.handlers['Swap'] = this._handleSwapEvent.bind(this);
    this.handlers['Burn'] = this._handleBurnEvent.bind(this);
    this.handlers['Mint'] = this._handleMintEvent.bind(this);
  }

  set poolAddress(address: Address) {
    this._poolAddress = address.toLowerCase();
  }

  get poolAddress() {
    if (this._poolAddress === undefined) {
      this._poolAddress = this.computePoolAddress(
        this.token0,
        this.token1,
        this.swapFeeUnits,
      );
    }
    return this._poolAddress;
  }

  computePoolAddress(token0: Address, token1: Address, fee: bigint): Address {
    if (token0 > token1) [token0, token1] = [token1, token0];

    const encodedKey = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ['address', 'address', 'uint24'],
        [token0, token1, BigInt.asUintN(24, fee)],
      ),
    );

    return ethers.utils.getCreate2Address(
      this.config.factory,
      encodedKey,
      this.config.poolInitHash,
    );
  }

  async initialize(
    blockNumber: number,
    options?: InitializeStateOptions<PoolState>,
  ) {
    await super.initialize(blockNumber, options);
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
          this.logger.error(
            `${this.parentName}: Pool ${this.poolAddress}, ` +
              `network=${this.dexHelper.config.data.network}: Unexpected ` +
              `error while handling event on blockNumber=${blockHeader.number}, ` +
              `blockHash=${blockHeader.hash} and parentHash=${
                blockHeader.parentHash
              } for Kyberswap Elastic, ${JSON.stringify(event)}`,
            e,
          );
          _state.isValid = false;
          return _state;
        }
      }
    } catch (e) {
      catchParseLogError(e, this.logger);
    }
    return null; // ignore unrecognized event
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
  public async generateState(
    blockNumber: number,
  ): Promise<Readonly<PoolState>> {
    this.addressesSubscribed[0] = this.poolAddress;

    const [_poolData, _balance0, _balance1, _blockTimestamp] =
      await this._fetchPoolData(blockNumber);

    const [_initializedTicks, _ticks] = await this._fetchTicks(blockNumber);

    const _tickDistance = TICK_DISTANCE[this.swapFeeUnits.toString()];
    const _maxTickLiquidity =
      BI_MAX_UINT128 / TickMath.getMaxNumberTicks(_tickDistance);

    return <PoolState>{
      pool: this.poolAddress,
      tickDistance: _tickDistance,
      poolOracle: undefined,
      poolObservation: undefined,
      maxTickLiquidity: _maxTickLiquidity,
      swapFeeUnits: this.swapFeeUnits,
      poolData: _poolData,
      ticks: _ticks,
      initializedTicks: _initializedTicks,
      reinvestLiquidity: _poolData.reinvestL,
      currentTick: _poolData.currentTick,
      balance0: _balance0,
      balance1: _balance1,
      isValid: !_poolData.locked,
      blockTimestamp: _blockTimestamp,
    };
  }

  /**
   * Fetch Pool States
   */
  private async _fetchPoolData(
    blockNumber: number,
  ): Promise<[PoolData, bigint, bigint, bigint]> {
    const _poolStateCalldata = this._constructPoolDataCalldata();

    const _fetchedPoolStates = await this.dexHelper.multiWrapper.tryAggregate<
      bigint | KyberElasticStateResponses
    >(
      false,
      _poolStateCalldata,
      blockNumber,
      this.dexHelper.multiWrapper.defaultBatchSize,
      false,
    );

    // Check the poolState call, if failed -> the pool doesn't exist
    assert(_fetchedPoolStates[0].success, ERR_POOL_DOES_NOT_EXIST);

    const [
      _poolState,
      _liquidityState,
      _feeGrowthGlobal,
      _secondsPerLiquidity,
      _rTokenSupply,
      _blockTimestamp,
      _balance0,
      _balance1,
    ] = [
      _fetchedPoolStates[0].returnData,
      _fetchedPoolStates[1].returnData,
      _fetchedPoolStates[2].returnData,
      _fetchedPoolStates[3].returnData,
      _fetchedPoolStates[4].returnData,
      _fetchedPoolStates[5].returnData,
      _fetchedPoolStates[6].returnData,
      _fetchedPoolStates[7].returnData,
    ] as [
      PoolStateResponse,
      LiquidityStateResponse,
      FeeGrowthGlobalResponse,
      SecondsPerLiquidityResponse,
      FeeGrowthGlobalResponse,
      bigint,
      bigint,
      bigint,
    ];

    const _poolData: PoolData = {
      sqrtP: _poolState.sqrtP,
      nearestCurrentTick: _poolState.nearestCurrentTick,
      currentTick: _poolState.currentTick,
      baseL: _liquidityState.baseL,
      reinvestL: _liquidityState.reinvestL,
      reinvestLLast: _liquidityState.reinvestLLast,
      feeGrowthGlobal: _feeGrowthGlobal,
      secondsPerLiquidityGlobal: _secondsPerLiquidity.secondsPerLiquidityGlobal,
      secondsPerLiquidityUpdateTime: _secondsPerLiquidity.lastUpdateTime,
      rTokenSupply: _rTokenSupply,
      locked: _poolState.locked,
    };

    return [_poolData, _balance0, _balance1, _blockTimestamp];
  }

  private _constructPoolDataCalldata(): MultiCallParams<KyberElasticStateResponses>[] {
    if (!this._stateRequestCallData) {
      this._stateRequestCallData = [
        {
          target: this.poolAddress,
          callData: this.poolContract.methods.getPoolState().encodeABI(),
          decodeFunction: decodePoolState,
        },
        {
          target: this.poolAddress,
          callData: this.poolContract.methods.getLiquidityState().encodeABI(),
          decodeFunction: decodeLiquidityState,
        },
        {
          target: this.poolAddress,
          callData: this.poolContract.methods.getFeeGrowthGlobal().encodeABI(),
          decodeFunction: uint256ToBigInt,
        },
        {
          target: this.poolAddress,
          callData: this.poolContract.methods
            .getSecondsPerLiquidityData()
            .encodeABI(),
          decodeFunction: decodeSecondsPerLiquidity,
        },
        {
          target: this.poolAddress,
          callData: this.poolContract.methods.totalSupply().encodeABI(),
          decodeFunction: uint256ToBigInt,
        },
        {
          target: generateConfig(this.network).multicallV2Address,
          callData: this.dexHelper.multiContract.methods
            .getCurrentBlockTimestamp()
            .encodeABI(),
          decodeFunction: uint256ToBigInt,
        },
        {
          target: this.token0,
          callData: this.erc20Iface.encodeFunctionData('balanceOf', [
            this.poolAddress,
          ]),
          decodeFunction: uint256ToBigInt,
        },
        {
          target: this.token1,
          callData: this.erc20Iface.encodeFunctionData('balanceOf', [
            this.poolAddress,
          ]),
          decodeFunction: uint256ToBigInt,
        },
      ];
    }

    return this._stateRequestCallData;
  }

  /**
   * Fetch Ticks States
   */

  private async _fetchTicks(
    blockNumber: number,
  ): Promise<
    [Record<NumberAsString, LinkedlistData>, Record<NumberAsString, TickInfo>]
  > {
    let _initializedTicks: Record<NumberAsString, LinkedlistData> = {};
    let _ticks: Record<NumberAsString, TickInfo> = {};

    const _tickIndice = await this._fetchInitializedTickIndice(blockNumber);

    const _tickCallata = this._constructTickCalldata(_tickIndice);
    const _fetchedTickData = await this.dexHelper.multiWrapper.tryAggregate<
      bigint | KyberElasticStateResponses
    >(
      false,
      _tickCallata,
      blockNumber,
      this.dexHelper.multiWrapper.defaultBatchSize,
      false,
    );

    const _fetchedInitializedTicks = _fetchedTickData.filter(
      (value, index) => index % 2 == 0,
    );
    const _fetchedTicks = _fetchedTickData.filter(
      (value, index) => index % 2 == 1,
    );

    this._reduceInitializedTicks(
      _tickIndice,
      _initializedTicks,
      _fetchedInitializedTicks.map(value => value.returnData),
    );
    this._reduceTicks(
      _tickIndice,
      _ticks,
      _fetchedTicks.map(value => value.returnData),
    );

    return [_initializedTicks, _ticks];
  }

  private async _fetchTickInRange(
    poolAddress: string,
    startTick: number,
    length: number,
    blockNumber: number,
  ) {
    const callRequest = {
      funcName: 'getTicksInRange',
      params: [poolAddress, startTick, length],
    };
    return this.ticksFeesReaderContract.methods[callRequest.funcName](
      ...callRequest.params,
    ).call({}, blockNumber || 'latest');
  }

  private async _fetchInitializedTickIndice(blockNumber: number) {
    let allTickIndice: number[] = [];
    let startTick = -887272;
    let size = 2000; // The highest number of ticks in a pool (include ks elastic, uniswapv3 is about 1700 ticks)

    let fetchedDone = false;
    while (!fetchedDone) {
      let tickInRage = await this._fetchTickInRange(
        this.poolAddress,
        startTick,
        size,
        blockNumber,
      );
      if (tickInRage.length < size || tickInRage[size - 1] == 0) {
        fetchedDone = true;
      }
      allTickIndice = _.concat(allTickIndice, tickInRage);
    }

    let index = allTickIndice.length - 1;
    while (allTickIndice[index] == 0) {
      index--;
    }

    return allTickIndice.slice(0, index);
  }

  private _constructTickCalldata(
    _tickIndice: Number[],
  ): MultiCallParams<KyberElasticStateResponses>[] {
    const _tickCallData: MultiCallParams<KyberElasticStateResponses>[] = [];

    for (const tickIndex of _tickIndice) {
      _tickCallData.push(
        {
          target: this.poolAddress,
          callData: this.kyberswapElasticIface.encodeFunctionData(
            'initializedTicks',
            [tickIndex],
          ),
          decodeFunction: decodeInitializedTicks,
        },
        {
          target: this.poolAddress,
          callData: this.kyberswapElasticIface.encodeFunctionData('ticks', [
            tickIndex,
          ]),
          decodeFunction: decodeTicks,
        },
      );
    }

    return _tickCallData;
  }

  private _reduceInitializedTicks(
    tickIndice: number[],
    initializedTicks: Record<NumberAsString, LinkedlistData>,
    initializedTicksToReduce: KyberElasticStateResponses[],
  ) {
    return initializedTicksToReduce.reduce<
      Record<NumberAsString, LinkedlistData>
    >((acc, curr, index) => {
      const value = curr as InitializedTicksResponse;
      acc[tickIndice[index]] = <LinkedlistData>{
        previous: value.previous,
        next: value.next,
      };
      return acc;
    }, initializedTicks);
  }

  private _reduceTicks(
    tickIndice: number[],
    ticks: Record<NumberAsString, TickInfo>,
    ticksToReduce: KyberElasticStateResponses[],
  ) {
    return ticksToReduce.reduce<Record<NumberAsString, TickInfo>>(
      (acc, curr, index) => {
        const value = curr as TicksResponse;
        acc[tickIndice[index]] = <TickInfo>{
          liquidityGross: value.liquidityGross,
          liquidityNet: value.liquidityNet,
          feeGrowthOutside: value.feeGrowthOutside,
          secondsPerLiquidityOutside: value.secondsPerLiquidityOutside,
        };
        return acc;
      },
      ticks,
    );
  }

  /**
   * Handle events
   */
  private _handleSwapEvent(
    event: any,
    pool: PoolState,
    log: Log,
    blockHeader: BlockHeader,
  ) {
    const newSqrtPriceX96 = bigIntify(event.args.sqrtPriceX96);
    const amount0 = bigIntify(event.args.amount0);
    const amount1 = bigIntify(event.args.amount1);
    const newTick = bigIntify(event.args.tick);
    const newLiquidity = bigIntify(event.args.liquidity);

    if (amount0 <= 0n && amount1 <= 0n) {
      this.logger.error(
        `${this.parentName}: amount0 <= 0n && amount1 <= 0n for ` +
          `${this.poolAddress} and ${blockHeader.number}. Check why it happened`,
      );
      pool.isValid = false;
      return pool;
    } else {
      const zeroForOne = amount0 > 0n;

      // ksElasticMath.swapFromEvent(
      //   pool,
      //   newSqrtPriceX96,
      //   newTick,
      //   newLiquidity,
      //   zeroForOne,
      // );

      return pool;
    }
  }

  private _handleBurnEvent(
    event: any,
    pool: PoolState,
    log: Log,
    blockHeader: BlockHeader,
  ) {
    const amount = bigIntify(event.args.amount);
    const tickLower = bigIntify(event.args.tickLower);
    const tickUpper = bigIntify(event.args.tickUpper);

    ksElasticMath.modifyPosition(pool, {
      tickLower,
      tickUpper,
      liquidityDelta: -BigInt.asIntN(128, BigInt.asIntN(256, amount)),
    });

    return pool;
  }

  private _handleMintEvent(
    event: any,
    pool: PoolState,
    log: Log,
    blockHeader: BlockHeader,
  ) {
    const amount = bigIntify(event.args.amount);
    const tickLower = bigIntify(event.args.tickLower);
    const tickUpper = bigIntify(event.args.tickUpper);

    ksElasticMath.modifyPosition(pool, {
      tickLower,
      tickUpper,
      liquidityDelta: amount,
    });

    return pool;
  }
}
