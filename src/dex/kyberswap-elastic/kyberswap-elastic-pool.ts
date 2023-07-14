import _ from 'lodash';
import { Interface } from '@ethersproject/abi';
import { NumberAsString } from '@paraswap/core';
import { BytesLike, ethers } from 'ethers';
import { AbiItem } from 'web3-utils';
import { Contract } from 'web3-eth-contract';
import { DeepReadonly } from 'ts-essentials';

import { Log, Logger, Address } from '../../types';
import { bigIntify, catchParseLogError } from '../../utils';
import { ERC20EventSubscriber } from '../../lib/generics-events-subscribers/erc20-event-subscriber';
import {
  StatefulEventSubscriber,
  InitializeStateOptions,
} from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { BI_MAX_UINT128 } from '../../bigint-constants';
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
import { MultiCallParams, MultiResult } from '../../lib/multi-wrapper';

export class KyberswapElasticEventPool extends StatefulEventSubscriber<PoolState> {
  handlers: {
    [event: string]: (
      event: any,
      state: DeepReadonly<PoolState>,
      log: Readonly<Log>,
    ) => DeepReadonly<PoolState> | null;
  } = {};

  logDecoder: (log: Log) => any;

  addressesSubscribed: string[];

  private _poolAddress?: Address;

  readonly erc20Iface = new Interface(ERC20ABI);
  readonly kyberswapElasticIface = new Interface(PoolABI);
  public poolContract: Contract;
  readonly multicallContract: Contract;
  readonly ticksFeesReaderContract: Contract;

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
    this.handlers['myEvent'] = this.handleMyEvent.bind(this);
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
  ): DeepReadonly<PoolState> | null {
    try {
      const event = this.logDecoder(log);
      if (event.name in this.handlers) {
        return this.handlers[event.name](event, state, log);
      }
    } catch (e) {
      catchParseLogError(e, this.logger);
    }

    return null;
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
    ];

    let _poolState,
      _liquidityState,
      _feeGrowthGlobal,
      _secondsPerLiquidity: KyberElasticStateResponses;

    [_poolState, _liquidityState, _feeGrowthGlobal, _secondsPerLiquidity] =
      await Promise.all(PoolDataRequests);
    _poolState = _poolState as PoolStateResponse;
    _liquidityState = _liquidityState as LiquidityStateResponse;
    _feeGrowthGlobal = _feeGrowthGlobal as FeeGrowthGlobalResponse;
    _secondsPerLiquidity = _secondsPerLiquidity as SecondsPerLiquidityResponse;

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
    };

    // const _ticks = this._getAllTicks(this.poolAddress, blockNumber),
    // const ticks = {};
    // const newTicks = _.filter(_ticks, tick => tick != 0);
    // const tickInfosFromContract = await this._getTickInfoFromContract(newTicks);
    // this._setTicksMapping(ticks, newTicks, tickInfosFromContract);

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

  _getPoolState(blockNumber: number): PoolStateResponse {
    const callRequest = {
      funcName: 'getPoolState',
      params: [],
    };
    const rs = this.poolContract.methods[callRequest.funcName](
      ...callRequest.params,
    ).call({}, blockNumber || 'latest');

    return rs;
    // return this.poolContract.methods[callRequest.funcName](
    //   ...callRequest.params,
    // ).call({}, blockNumber || 'latest');
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
    // return tickInfosFromContract.reduce<Record<string, TickInfo>>(
    //   (acc, element, index) => {
    //     acc[tickArray[index]] = {
    //       liquidityGross: bigIntify(element.liquidityGross),
    //       liquidityNet: bigIntify(element.liquidityNet),
    //       tickCumulativeOutside: bigIntify(element.feeGrowthOutside),
    //       secondsPerLiquidityOutsideX128: bigIntify(
    //         element.secondsPerLiquidityOutside,
    //       ),
    //       secondsOutside: bigIntify(
    //         element.liquidityNet * element.secondsPerLiquidityOutside,
    //       ),
    //       initialized: true,
    //       index: tickArray[index],
    //     };
    //     return acc;
    //   },
    //   ticks,
    // );
  }

  _buildParamsForTicksCall(
    ticks: Number[],
  ): MultiCallParams<bigint | TickInfo>[] {
    const callData = new Array<MultiCallParams<bigint | TickInfo>>();
    callData.push(
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
    );

    // ticks.map(tickIndex =>{
    //   callData.push({
    //     target: this.poolAddress,
    //     callData: this.kyberswapElasticIface.encodeFunctionData('ticks', [
    //       tickIndex,
    //     ]),
    //     decodeFunction: this._decodeTicksCallResults,
    //   })
    // });

    return callData;
  }

  // _decodeTicksCallResults(multiCallTickResult: MultiResult<BytesLike> | BytesLike,): TickInfo {
  //   const result = new Array(multiCallTickResult.length);
  //   multiCallTickResult.forEach((element, index) => {
  //     result[index] = this.kyberswapElasticIface.decodeFunctionResult(
  //       'ticks',
  //       element,
  //     );
  //   });
  //   return result;
  // }

  async _getTickInfoFromContract(ticks: number[], blockNumber: number) {
    // const multiCallResult = (
    //   await this.multicallContract.methods
    //     .aggregate(this._buildParamsForTicksCall(ticks))
    //     .call()
    // ).returnData;
    // return this._decodeTicksCallResults(multiCallResult);
    // const [multiCallResult] =
    // await this.dexHelper.multiWrapper.tryAggregate<
    //   TickInfo
    // >(
    //   false,
    //   this._buildParamsForTicksCall(ticks),
    //   blockNumber,
    //   this.dexHelper.multiWrapper.defaultBatchSize,
    //   false,
    // );
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
}
