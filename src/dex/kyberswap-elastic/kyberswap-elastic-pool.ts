import _ from 'lodash';
import { Interface } from '@ethersproject/abi';
import { NumberAsString } from '@paraswap/core';
import { BytesLike, ethers } from 'ethers';
import { AbiItem } from 'web3-utils';
import { Contract } from 'web3-eth-contract';
import { DeepReadonly } from 'ts-essentials';

import { Log, Logger, Address, BlockHeader } from '../../types';
import { bigIntify, catchParseLogError } from '../../utils';
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

import { KyberswapElasticConfig } from './config';
import {
  PoolState,
  TickInfo,
  PoolData,
  KyberElasticStateResponses,
  PoolStateResponse,
  LiquidityStateResponse,
  FeeGrowthGlobalResponse,
  SecondsPerLiquidityResponse,
} from './types';
import { TickMath } from './contract-math/TickMath';
import { ksElasticMath } from './contract-math/kyberswap-elastic-math';
import { MultiCallParams, MultiResult } from '../../lib/multi-wrapper';

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

  addressesSubscribed: string[];
  public poolContract: Contract;

  private _poolAddress?: Address;
  readonly erc20Iface = new Interface(ERC20ABI);
  readonly kyberswapElasticIface = new Interface(PoolABI);
  readonly multicallContract: Contract;
  readonly ticksFeesReaderContract: Contract;
  public token0sub: ERC20EventSubscriber;
  public token1sub: ERC20EventSubscriber;

  constructor(
    readonly parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    protected config = KyberswapElasticConfig[parentName][network],
    readonly swapFeeUnits: bigint,
    readonly token0: Address,
    readonly token1: Address,
  ) {
    super(parentName, `${token0}_${token1}_${swapFeeUnits}`, dexHelper, logger);

    this.token0 = token0.toLowerCase();
    this.token1 = token1.toLowerCase();

    this.logDecoder = (log: Log) => this.kyberswapElasticIface.parseLog(log);
    this.addressesSubscribed = new Array<Address>(1);

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

    // Add handlers
    this.token0sub = getERC20Subscriber(this.dexHelper, this.token0);
    this.token1sub = getERC20Subscriber(this.dexHelper, this.token1);
    this.handlers['Swap'] = this.handleSwapEvent.bind(this);
    this.handlers['Burn'] = this.handleBurnEvent.bind(this);
    this.handlers['Mint'] = this.handleMintEvent.bind(this);
  }

  get poolAddress() {
    if (this._poolAddress === undefined) {
      this._poolAddress = this._computePoolAddress(
        this.token0,
        this.token1,
        this.swapFeeUnits,
      );
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
          if (e instanceof Error) {
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
                } for Kyberswap Elastic, ${JSON.stringify(event)}`,
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
    const PoolDataRequests = [
      this._getPoolState(blockNumber),
      this._getLiquidityState(blockNumber),
      this._getFeeGrowthGlobal(blockNumber),
      this._getSecondsPerLiquidityData(blockNumber),
      this._getRTokenSupply(blockNumber),
    ];

    let _poolState,
      _liquidityState,
      _feeGrowthGlobal,
      _secondsPerLiquidity,
      _rTokenSupply: KyberElasticStateResponses;

    [
      _poolState,
      _liquidityState,
      _feeGrowthGlobal,
      _secondsPerLiquidity,
      _rTokenSupply,
    ] = await Promise.all(PoolDataRequests);
    _poolState = _poolState as PoolStateResponse;
    _liquidityState = _liquidityState as LiquidityStateResponse;
    _feeGrowthGlobal = _feeGrowthGlobal as FeeGrowthGlobalResponse;
    _secondsPerLiquidity = _secondsPerLiquidity as SecondsPerLiquidityResponse;
    _rTokenSupply = _rTokenSupply as FeeGrowthGlobalResponse;

    const poolData: PoolData = {
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
    };

    // Fetch ticks
    const _ticks = await this._getAllTicks(this.poolAddress, blockNumber);
    const ticks = {};
    const newTicks = _.filter(_ticks, tick => tick != 0);
    const tickInfosFromContract = await this._getTickInfoFromContract(newTicks);
    this._setTicksMapping(ticks, newTicks, tickInfosFromContract);

    // Not really a good place to do it, but in order to save RPC requests,
    // put it here
    this.addressesSubscribed[0] = this.poolAddress;

    const tickDistance = this.state?.tickDistance;
    let isValid = false;
    if (_poolState.locked == false || _poolState.locked == undefined) {
      isValid = true;
    }

    return <PoolState>{
      pool: this.poolAddress,
      tickDistance: tickDistance,
      poolOracle: undefined,
      poolObservation: undefined,
      maxTickLiquidity:
        BI_MAX_UINT128 / TickMath.getMaxNumberTicks(tickDistance as bigint),
      swapFeeUnits: this.swapFeeUnits,
      poolData: poolData,
      // sqrtPriceX96: bigIntify(_poolState.sqrtP),
      // liquidity: bigIntify(_liquidityState.baseL),
      // ticks: ticks,
      // isValid: isValid,
      // currentTick: bigIntify(currentTick),
      // reinvestLiquidity: bigIntify(_liquidityState.reinvestL),
    };
  }

  // Its just a dummy example
  handleMyEvent(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    return null;
  }

  _computePoolAddress(token0: Address, token1: Address, fee: bigint): Address {
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

  _getPoolState(blockNumber: number): PoolStateResponse {
    const callRequest = {
      funcName: 'getPoolState',
      params: [],
    };
    return this.poolContract.methods[callRequest.funcName](
      ...callRequest.params,
    ).call({}, blockNumber || 'latest');
  }

  _getLiquidityState(blockNumber: number): LiquidityStateResponse {
    return this.poolContract.methods['getLiquidityState']().call(
      {},
      blockNumber || 'latest',
    );
  }

  _getFeeGrowthGlobal(blockNumber: number): bigint {
    return this.poolContract.methods['getFeeGrowthGlobal']().call(
      {},
      blockNumber || 'latest',
    );
  }

  _getSecondsPerLiquidityData(
    blockNumber: number,
  ): SecondsPerLiquidityResponse {
    return this.poolContract.methods['getSecondsPerLiquidityData']().call(
      {},
      blockNumber || 'latest',
    );
  }

  _getRTokenSupply(blockNumber: number): FeeGrowthGlobalResponse {
    return this.poolContract.methods['totalSupply']().call(
      {},
      blockNumber || 'latest',
    );
  }

  async _getTickInRange(
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

  async _getAllTicks(poolAddress: string, blockNumber: number) {
    let startTick = -887272;
    let length = 1000;
    let shouldFinish = false;
    let allTicks: number[] = [];
    while (!shouldFinish) {
      let ticks = await this._getTickInRange(
        poolAddress,
        startTick,
        length,
        blockNumber,
      );
      if (ticks.length < length || ticks[length - 1] == 0) {
        shouldFinish = true;
      }
      allTicks = _.concat(allTicks, ticks);
    }
    return _.filter(allTicks, tick => tick != 0);
  }

  _setTicksMapping(
    ticks: Record<NumberAsString, TickInfo>,
    tickArray: number[],
    tickInfosFromContract: any[],
  ) {
    return tickInfosFromContract.reduce<Record<string, TickInfo>>(
      (acc, element, index) => {
        acc[tickArray[index]] = {
          liquidityGross: bigIntify(element.liquidityGross),
          liquidityNet: bigIntify(element.liquidityNet),
          feeGrowthOutside: bigIntify(
            element.liquidityNet * element.secondsPerLiquidityOutside,
          ),
          secondsPerLiquidityOutside: bigIntify(
            element.secondsPerLiquidityOutside,
          ),
        };
        return acc;
      },
      ticks,
    );
  }

  _buildParamsForTicksCall(ticks: Number[]): {
    target: string;
    callData: string;
  }[] {
    return ticks.map(tickIndex => ({
      target: this.poolAddress,
      callData: this.kyberswapElasticIface.encodeFunctionData('ticks', [
        tickIndex,
      ]),
    }));
  }

  decodeTicksCallResults(multiCallTickResult: []) {
    const result = new Array(multiCallTickResult.length);
    multiCallTickResult.forEach((element, index) => {
      result[index] = this.kyberswapElasticIface.decodeFunctionResult(
        'ticks',
        element,
      );
    });
    return result;
  }

  async _getTickInfoFromContract(ticks: number[]) {
    const multiCallResult = (
      await this.multicallContract.methods
        .aggregate(this._buildParamsForTicksCall(ticks))
        .call()
    ).returnData;
    return this.decodeTicksCallResults(multiCallResult);
  }

  // private _getStateRequestCallData() {
  //   if (!this._stateRequestCallData) {
  //     const callData: MultiCallParams<
  //       bigint | DecodedStateMultiCallResultWithRelativeBitmaps
  //     >[] = [
  //       {
  //         target: this.token0,
  //         callData: this.erc20Interface.encodeFunctionData('balanceOf', [
  //           this.poolAddress,
  //         ]),
  //         decodeFunction: uint256ToBigInt,
  //       },
  //       {
  //         target: this.token1,
  //         callData: this.erc20Interface.encodeFunctionData('balanceOf', [
  //           this.poolAddress,
  //         ]),
  //         decodeFunction: uint256ToBigInt,
  //       },
  //       {
  //         target: this.stateMultiContract.options.address,
  //         callData: this.stateMultiContract.methods
  //           .getFullStateWithRelativeBitmaps(
  //             this.factoryAddress,
  //             this.token0,
  //             this.token1,
  //             this.feeCode,
  //             this.getBitmapRangeToRequest(),
  //             this.getBitmapRangeToRequest(),
  //           )
  //           .encodeABI(),
  //         decodeFunction: decodeStateMultiCallResultWithRelativeBitmaps,
  //       },
  //     ];
  //     this._stateRequestCallData = callData;
  //   }
  //   return this._stateRequestCallData;
  // }

  /**
   * Handle events
   */
  handleSwapEvent(
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

  handleBurnEvent(
    event: any,
    pool: PoolState,
    log: Log,
    blockHeader: BlockHeader,
  ) {
    const amount = bigIntify(event.args.amount);
    const tickLower = bigIntify(event.args.tickLower);
    const tickUpper = bigIntify(event.args.tickUpper);

    // ksElasticMath._modifyPosition(pool, {
    //   tickLower,
    //   tickUpper,
    //   liquidityDelta: -BigInt.asIntN(128, BigInt.asIntN(256, amount)),
    // });

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

    // ksElasticMath._modifyPosition(pool, {
    //   tickLower,
    //   tickUpper,
    //   liquidityDelta: amount,
    // });

    return pool;
  }
}
