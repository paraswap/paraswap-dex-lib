import _, { indexOf } from 'lodash';
import { Contract } from 'web3-eth-contract';
import { Interface } from '@ethersproject/abi';
import { ethers } from 'ethers';
import { assert, DeepReadonly } from 'ts-essentials';
import { Log, Logger, BlockHeader, Address } from '../../types';
import {
  InitializeStateOptions,
  StatefulEventSubscriber,
} from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  PoolState,
  TickInfo,
  TickInfoMappingsWithBigNumber,
  LimitOrderTickData,
  LimitOrderTickInfoMappingsWithBigNumber,
  DecodedGetReserves,
  DecodedGetTokenProtocolFees,
  DecodedGetImmutables,DecodedGetPriceAndNearestTicks,
  DecodedGetSecondsGrowthAndLastObservation,
  DecodedTicksData,
  DecodedLimitOrderTicksData,
  DecodedGetTickState,
  DecodedGetTotals,
} from './types';
import DfynV2PoolABI from '../../abi/dfyn-v2/DfynV2Pool.abi.json';
import DfynV2PoolHelperABI from '../../abi/dfyn-v2/DfynV2PoolHelper.abi.json';
import DfynV2VaultABI from '../../abi/dfyn-v2/DfynV2Vault.abi.json';
import { bigIntify, catchParseLogError, getDexKeysWithNetwork, isSampled } from '../../utils';
import { MultiCallParams } from '../../lib/multi-wrapper';
import { NumberAsString } from '@paraswap/core';
import {
  //DEFAULT_POOL_INIT_CODE_HASH,
   OUT_OF_RANGE_ERROR_POSTFIX
} from './constants';
import { uint256ToBigInt,uint160ToBigInt, uint128ToBigInt } from '../../lib/decoders';
import { 
  decodeGetReserves,decodeGetImmutables,decodeGetPriceAndNearestTicks,
  decodeGetSecondsGrowthAndLastObservation,decodeTicks,
  decodeLimitOrderTicks,decodeGetTickState,decodedGetTotals,decodeGetTokenProtocolFees
} from './utils';
import { dfynV2Math } from './contract-math/dfyn-v2-math';
import { address } from '@hashflow/sdk';
import { RebaseLibrary } from './contract-math/RebaseLibrary';
import { Network } from '../../constants';
import { config } from 'yargs';
import { DfynConfig } from '../uniswap-v2/dfyn';
import { DfynV2Config } from './config';

export class DfynV2EventPool extends StatefulEventSubscriber<PoolState> {
  handlers: {
    [event: string]: (
      event: any,
      pool: PoolState,
      log: Log,
      blockHeader: Readonly<BlockHeader>,
    ) => PoolState;
  } = {};

  logDecoder: (log: Log) => any;

  readonly token0: Address;

  readonly token1: Address;

  private _poolAddress?: Address;

  private _stateRequestCallData?: MultiCallParams<
   DecodedGetReserves | 
   DecodedGetTokenProtocolFees |
   DecodedGetImmutables | 
   DecodedGetPriceAndNearestTicks | 
   DecodedGetSecondsGrowthAndLastObservation  | 
   bigint
  >[];

  private _vaultBalanceCallData?: MultiCallParams<bigint>[];
  
  private _getTotalsCallData?: MultiCallParams<DecodedGetTotals>[];

  private _ticksStateCallData?: MultiCallParams<DecodedGetTickState>[];

  private _ticksCallData?: MultiCallParams<DecodedTicksData>[];

  private _limitOrderTicksCallData?: MultiCallParams<DecodedLimitOrderTicksData>[];

  public readonly poolIface = new Interface(DfynV2PoolABI);
  public readonly poolHelper = new Interface(DfynV2PoolHelperABI)
  public readonly vault = new Interface(DfynV2VaultABI)

  // public readonly feeCodeAsString;

  constructor(
    readonly dexHelper: IDexHelper,
    parentName: string,
    readonly poolHelperContract: Contract,
    readonly erc20Interface: Interface,
    protected readonly factoryAddress: Address,
    // public readonly feeCode: bigint,
    token0: Address,
    token1: Address,
    logger: Logger,
    mapKey: string = '',
    readonly poolInitCodeHash = DfynV2Config[parentName][dexHelper.config.data.network].DEFAULT_POOL_INIT_CODE_HASH,
  ) {
    super(parentName, `${token0}_${token1}`, dexHelper, logger, true, mapKey);
    //this.feeCodeAsString = feeCode.toString();
    this.token0 = token0.toLowerCase();
    this.token1 = token1.toLowerCase();
    this.logDecoder = (log: Log) => this.poolIface.parseLog(log);
    this.addressesSubscribed = new Array<Address>(1);

    // Add handlers
    this.handlers['Swap'] = this.handleSwapEvent.bind(this);
    // this.handlers['Burn'] = this.handleBurnEvent.bind(this);
    // this.handlers['Mint'] = this.handleMintEvent.bind(this);
    // this.handlers['SetFeeProtocol'] = this.handleSetFeeProtocolEvent.bind(this);
    // this.handlers['IncreaseObservationCardinalityNext'] =
    //   this.handleIncreaseObservationCardinalityNextEvent.bind(this);

    // // Wen need them to keep balance of the pool up to date
    // this.handlers['Collect'] = this.handleCollectEvent.bind(this);
    // // Almost the same as Collect, but for pool owners
    // this.handlers['CollectProtocol'] = this.handleCollectEvent.bind(this);
    // this.handlers['Flash'] = this.handleFlashEvent.bind(this);
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

      const dfynV2EventLoggingSampleRate =
        this.dexHelper.config.data.dfynV2EventLoggingSampleRate;
      if (
        !this.dexHelper.config.isSlave &&
        dfynV2EventLoggingSampleRate &&
        isSampled(dfynV2EventLoggingSampleRate)
      ) {
        this.logger.info(
          `event=${event.name} - block=${
            blockHeader.number
          }. Log sampled at rate ${dfynV2EventLoggingSampleRate * 100}%`,
        );
      }

      if (event.name in this.handlers) {
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
                } for DfynV2, ${JSON.stringify(event)}`,
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
    
    if (!this._stateRequestCallData) {
      const callData: MultiCallParams<
        DecodedGetReserves | 
        DecodedGetTokenProtocolFees |
        DecodedGetImmutables | 
        DecodedGetPriceAndNearestTicks | 
        DecodedGetSecondsGrowthAndLastObservation | 
        bigint
      >[] = 
      
      [
        {
          target: this.poolAddress,
          callData: this.poolIface.encodeFunctionData('getReserves'),
          decodeFunction: decodeGetReserves,
        },
        {
          target: this.poolAddress,
          callData: this.poolIface.encodeFunctionData('getTokenProtocolFees'),
          decodeFunction: decodeGetTokenProtocolFees,
        },
        {
          target: this.poolAddress,
          callData: this.poolIface.encodeFunctionData('getImmutables'),
          decodeFunction: decodeGetImmutables,
        },
        {
          target: this.poolAddress,
          callData: this.poolIface.encodeFunctionData('getPriceAndNearestTicks'),
          decodeFunction: decodeGetPriceAndNearestTicks,
        },
        {
          target: this.poolAddress,
          callData: this.poolIface.encodeFunctionData('getSecondsGrowthAndLastObservation'),
          decodeFunction: decodeGetSecondsGrowthAndLastObservation,
        },
        {
          target: this.poolAddress,
          callData: this.poolIface.encodeFunctionData('tickCount'),
          decodeFunction: uint256ToBigInt
        },
        {
          target: this.poolAddress,
          callData: this.poolIface.encodeFunctionData('dfynFee'),
          decodeFunction: uint256ToBigInt,
        },
        {
          target: this.poolAddress,
          callData: this.poolIface.encodeFunctionData('limitOrderFee'),
          decodeFunction: uint256ToBigInt,
        },
        {
          target: this.poolAddress,
          callData: this.poolIface.encodeFunctionData('liquidity'),
          decodeFunction: uint128ToBigInt,
        },
        {
          target: this.poolAddress,
          callData: this.poolIface.encodeFunctionData('feeGrowthGlobal0'),
          decodeFunction: uint256ToBigInt,
        },
        {
          target: this.poolAddress,
          callData: this.poolIface.encodeFunctionData('feeGrowthGlobal1'),
          decodeFunction: uint256ToBigInt,
        },
        {
          target: this.poolAddress,
          callData: this.poolIface.encodeFunctionData('limitOrderReserve0'),
          decodeFunction: uint256ToBigInt,
        },
        {
          target: this.poolAddress,
          callData: this.poolIface.encodeFunctionData('limitOrderReserve1'),
          decodeFunction: uint256ToBigInt,
        },
        {
          target: this.poolAddress,
          callData: this.poolIface.encodeFunctionData('token0LimitOrderFee'),
          decodeFunction: uint256ToBigInt,
        },
        {
          target: this.poolAddress,
          callData: this.poolIface.encodeFunctionData('token1LimitOrderFee'),
          decodeFunction: uint256ToBigInt,
        },
        {
          target: this.poolAddress,
          callData: this.poolIface.encodeFunctionData('nearestPrice'),
          decodeFunction: uint160ToBigInt,
        }
      ];
      this._stateRequestCallData = callData;
    }
    return this._stateRequestCallData;
  }

  private _getVaultBalanceCallData( vaultAddress : Address ) { 

    if (!this._vaultBalanceCallData) {
      const callData: MultiCallParams<bigint>[] = 
      [
        {
          target: vaultAddress,
          callData: this.vault.encodeFunctionData('balanceOf',
            [this.token0,this.poolAddress]
          ),
          decodeFunction: uint256ToBigInt,
        },
        {
          target: vaultAddress,
          callData: this.vault.encodeFunctionData('balanceOf',
            [this.token1,this.poolAddress]
          ),
          decodeFunction: uint256ToBigInt,
        }
      ];
      this._vaultBalanceCallData = callData;
    }
    return this._vaultBalanceCallData;
  }

  private _getTicksStateCallData( ticksCount: number ) { 

    if (!this._ticksStateCallData) {
      const callData: MultiCallParams<
        DecodedGetTickState
      >[] = 
      [
        {
          target: this.poolHelperContract.options.address,
          callData: this.poolHelper.encodeFunctionData('getTickState',
          [
            this.poolAddress,
            ticksCount.toString()
          ]),
          decodeFunction: decodeGetTickState,
        }
      ];
      this._ticksStateCallData = callData;
    }
    return this._ticksStateCallData;
  }

  private _getTotals( token0: address, token1 : address, vaultAddress : Address ) { 

    if (!this._getTotalsCallData) {
      const callData: MultiCallParams<
      DecodedGetTotals
      >[] = 
      [
        {
          target: vaultAddress,
          callData: this.vault.encodeFunctionData('totals',
          [
            token0
          ]),
          decodeFunction: decodedGetTotals,
        },{
          target: vaultAddress,
          callData: this.vault.encodeFunctionData('totals',
          [
            token1
          ]),
          decodeFunction: decodedGetTotals,
        }
      ];
      this._getTotalsCallData = callData;
    }
    return this._getTotalsCallData;
  }

  private _getTicks(tickState: string | any[]) {
    
    if (!this._ticksCallData) {
        const callData: MultiCallParams<DecodedTicksData>[] = [];
        for (let i = 0;i < tickState.length; i++){
         callData.push({
            target: this.poolAddress,
            callData: this.poolIface.encodeFunctionData('ticks',[tickState[i].index]),
            decodeFunction: decodeTicks,
          })
        }
      this._ticksCallData = callData;
      
    }
    return this._ticksCallData;
  }

  private _getLimitOrderTicks(limitOrderTickState: string | any[]) {
    
    if (!this._limitOrderTicksCallData) {
        const callData: MultiCallParams<DecodedLimitOrderTicksData>[] = [];
        for (let i = 0;i < limitOrderTickState.length; i++){
          callData.push({
            target: this.poolAddress,
            callData: this.poolIface.encodeFunctionData('limitOrderTicks',[limitOrderTickState[i].index]),
            decodeFunction: decodeLimitOrderTicks,
          })
        }
      this._limitOrderTicksCallData = callData;
      
    }
    return this._limitOrderTicksCallData;
  }

  async generateState(blockNumber: number): Promise<Readonly<PoolState>> {

    
    const callData = this._getStateRequestCallData();
    
    const [
      reserves,
      resProtocolFees,
      resImmutables,
      resPriceAndNearestTicks,
      resSecondsGrowthAndLastObservation,
      resTickCount,
      resDfynFee,
      resLimitOrderFee,
      resLiquidity,
      resFeeGrowthGlobal0,
      resFeeGrowthGlobal1,
      resLimitOrderReserve0,
      resLimitOrderReserve1,
      resToken0LimitOrderFee,
      resToken1LimitOrderFee,
      resNearestPrice
    ] =
      await this.dexHelper.multiWrapper.tryAggregate<
      DecodedGetReserves | 
      DecodedGetTokenProtocolFees |
      DecodedGetImmutables | 
      DecodedGetPriceAndNearestTicks | 
      DecodedGetSecondsGrowthAndLastObservation | 
      bigint
      >(
        false,
        callData,
        blockNumber,
        this.dexHelper.multiWrapper.defaultBatchSize,
        false,
      );

    
    assert(reserves.success, 'Pool does not exist');

    const [
      balance,
      protocolFees,
      immutables,
      priceAndNearestTicks, 
      secondsGrowthAndLastObservation,
      tickCount,
      dfynFee,
      limitOrderFee,
      liquidity,
      feeGrowthGlobal0,
      feeGrowthGlobal1,
      limitOrderReserve0,
      limitOrderReserve1,
      token0LimitOrderFee,
      token1LimitOrderFee,
      nearestPrice
    ] = [
      reserves.returnData,
      resProtocolFees.returnData,
      resImmutables.returnData,
      resPriceAndNearestTicks.returnData,
      resSecondsGrowthAndLastObservation.returnData,
      resTickCount.returnData,
      resDfynFee.returnData,
      resLimitOrderFee.returnData,
      resLiquidity.returnData,
      resFeeGrowthGlobal0.returnData,
      resFeeGrowthGlobal1.returnData,
      resLimitOrderReserve0.returnData,
      resLimitOrderReserve1.returnData,
      resToken0LimitOrderFee.returnData,
      resToken1LimitOrderFee.returnData,
      resNearestPrice.returnData,
    ] as [
      DecodedGetReserves,
      DecodedGetTokenProtocolFees,
      DecodedGetImmutables,
      DecodedGetPriceAndNearestTicks,
      DecodedGetSecondsGrowthAndLastObservation,
      bigint, bigint, bigint , bigint , bigint, bigint, bigint, bigint, bigint, bigint, bigint
    ]
    
    const vaultBalanceCallData = await this._getVaultBalanceCallData(immutables._vault)
    const [resVaultBalance0,resVaultBalance1] = await this.dexHelper.multiWrapper.tryAggregate<bigint>(
      false,
      vaultBalanceCallData,
      blockNumber,
      this.dexHelper.multiWrapper.defaultBatchSize,
      false,
    )
    const [vaultBalance0,vaultBalance1] = [resVaultBalance0.returnData,resVaultBalance1.returnData] as [bigint,bigint]

    const vaultTotalsCallData = await this._getTotals(this.token0, this.token1 ,immutables._vault)
    const [resVaultTotals0,resVaultTotals1] = await this.dexHelper.multiWrapper.tryAggregate<DecodedGetTotals>(
      false,
      vaultTotalsCallData,
      blockNumber,
      this.dexHelper.multiWrapper.defaultBatchSize,
      false,
    )

    const [vaultTotals0,vaultTotals1] = [resVaultTotals0.returnData,resVaultTotals1.returnData] as [DecodedGetTotals,DecodedGetTotals]

    const getTicksStateCallData = await this._getTicksStateCallData(Number(tickCount))
    
    const resTickStatecallData = await this.dexHelper.multiWrapper.tryAggregate<DecodedGetTickState>
    (
      false,
      getTicksStateCallData,
      blockNumber,
      this.dexHelper.multiWrapper.defaultBatchSize,
      false,
    );
   
    
    let tickState : any = [], limitOrderTickState : any = []
   
    for (let i = 0; i<= Number(tickCount)-1; i++){
      tickState.push({
        index : ((resTickStatecallData[0].returnData.ticks as any)[0][i].index as TickInfoMappingsWithBigNumber).toString()
      })
      limitOrderTickState.push({
        index : ((resTickStatecallData[0].returnData.ticks as any)[0][i].index as LimitOrderTickInfoMappingsWithBigNumber).toString()
      })
    }
    
    const ticksCallData = await this._getTicks(tickState)

    const resTicks = await this.dexHelper.multiWrapper.tryAggregate<DecodedTicksData>
    (
      false,
      ticksCallData,
      blockNumber,
      this.dexHelper.multiWrapper.defaultBatchSize,
      false,
    );

    const limitOrderTicksCallData = await this._getLimitOrderTicks(limitOrderTickState)
    
    const resLimitOrderTicks = await this.dexHelper.multiWrapper.tryAggregate<DecodedLimitOrderTicksData>
    (
      false,
      limitOrderTicksCallData,
      blockNumber,
      this.dexHelper.multiWrapper.defaultBatchSize,
      false,
    );
    
    let ticksData : any = [], limitOrderTicksData : any = []
    for (let i = 0; i<= Number(tickCount)-1; i++) {
      ticksData.push({
        index: (resTickStatecallData[0].returnData.ticks as any)[0][i].index,
        value : (resTicks[0].returnData.ticks[i] as any) as TickInfoMappingsWithBigNumber
      });
      limitOrderTicksData.push({
        index: (resTickStatecallData[0].returnData.ticks as any)[0][i].index,
        value: (resLimitOrderTicks[0].returnData.limitOrderTicks[i] as any) as LimitOrderTickInfoMappingsWithBigNumber
      });
    }
    
    const ticks = {};
    const limitOrderTicks = {};

    this._reduceTicks(ticks,ticksData);
    this._reduceLimitOrderTicks(limitOrderTicks,limitOrderTicksData)
    
    return {
      pool: this._computePoolAddress(immutables._token0,immutables._token1),
      balance0: bigIntify(balance._reserve0),
      balance1: bigIntify(balance._reserve1),
      token0ProtocolFee: bigIntify(protocolFees._token0ProtocolFee),
      token1ProtocolFee: bigIntify(protocolFees._token1ProtocolFee),
      tickSpacing: bigIntify(immutables._tickSpacing),
      swapFee: bigIntify(immutables._swapFee),
      slot0: {
        sqrtPriceX96: bigIntify(priceAndNearestTicks._price),
        tick: bigIntify(priceAndNearestTicks._nearestTick),
      },
      nearestPrice: nearestPrice,
      vaultBalance0: vaultBalance0,
      vaultBalance1: vaultBalance1,
      secondsGrowthGlobal: bigIntify(secondsGrowthAndLastObservation._secondsGrowthGlobal),
      lastObservation: bigIntify(secondsGrowthAndLastObservation._lastObservation), // block.timestamp
      ticks,
      limitOrderTicks,
      isValid: true,
      dfynFee: dfynFee,
      limitOrderFee: limitOrderFee,
      liquidity: liquidity,
      feeGrowthGlobal0: feeGrowthGlobal0,
      feeGrowthGlobal1: feeGrowthGlobal1,
      limitOrderReserve0: limitOrderReserve0,
      limitOrderReserve1: limitOrderReserve1,
      token0LimitOrderFee: token0LimitOrderFee,
      token1LimitOrderFee: token1LimitOrderFee,
      total0:{ 
        base:bigIntify(vaultTotals0.base),
        elastic: bigIntify(vaultTotals0.elastic)
      },
      total1:{
        base:bigIntify(vaultTotals1.base),
        elastic: bigIntify(vaultTotals1.elastic)
      }
    }; 
  }

  handleSwapEvent(
    event: any,
    pool: PoolState,
    log: Log,
    blockHeader: BlockHeader,
  ) {
    debugger
    const newSqrtPriceX96 = bigIntify(event.args.price);
    const amountIn = bigIntify(event.args.amountIn);
    const amountOut = bigIntify(event.args.amountOut);
    const newTick = bigIntify(event.args.tick);
    const zeroForOne = event.args.zeroForOne;
    //const newLiquidity = bigIntify(event.args.);
    const lastObservation = bigIntify(blockHeader.timestamp);

    if (amountIn <= 0n && amountOut <= 0n) {
      this.logger.error(
        `${this.parentName}: amount0 <= 0n && amount1 <= 0n for ` +
          `${this.poolAddress} and ${blockHeader.number}. Check why it happened`,
      );
      pool.isValid = false;
      return pool;
    } else {
      const exactIn = newSqrtPriceX96 > pool.slot0.sqrtPriceX96 ? true : false

      const total = zeroForOne ? pool.total0 : pool.total1;
      if(zeroForOne) {
        pool.vaultBalance0 += amountIn
        const amount = RebaseLibrary.toElastic(total,amountIn,true);
        total.elastic = total.elastic + amount;
        total.base = total.base + amountIn;
        pool.total0 = total;
      } else {
        pool.vaultBalance1 += amountIn
        const amount = RebaseLibrary.toElastic(total,amountIn,true);
        total.elastic = total.elastic + amount;
        total.base = total.base + amountIn;
        pool.total1 = total;
      }
      
      dfynV2Math.swapFromEvent(
        lastObservation,
        pool,
        newSqrtPriceX96,
        newTick,
        exactIn ? amountIn : -amountOut,
        //newLiquidity,
        zeroForOne,
      );
      return pool;
    }
  }



  private _reduceTicks(
    ticks: Record<NumberAsString, TickInfo>,
    ticksToReduce: TickInfoMappingsWithBigNumber[],
  ) {
    return ticksToReduce.reduce<Record<string, TickInfo>>((acc, curr) => {
      const { index, value } = curr;
      acc[index] = {
        liquidity: bigIntify(value.liquidity),
        previousTick: bigIntify(value.previousTick),
        nextTick:bigIntify(value.nextTick) ,
        feeGrowthOutside0:bigIntify(value.feeGrowthOutside0) ,
        feeGrowthOutside1:bigIntify(value.feeGrowthOutside1) ,
        secondsGrowthOutside:bigIntify(value.secondsGrowthOutside)
      };
      return acc;
    }, ticks);
  }

  private _reduceLimitOrderTicks(
    limitOrderTicks: Record<NumberAsString,LimitOrderTickData>,
    limitOrderTicksToReduce: LimitOrderTickInfoMappingsWithBigNumber[],
  ) {
    return limitOrderTicksToReduce.reduce<Record<string, LimitOrderTickData>>((acc, curr) => {
      const { index, value } = curr;
      acc[index] = {
        token0Liquidity: bigIntify(value.token0Liquidity),
        token1Liquidity: bigIntify(value.token1Liquidity),
        token0Claimable: bigIntify(value.token0Claimable),
        token1Claimable: bigIntify(value.token1Claimable),
        token0ClaimableGrowth: bigIntify(value.token0ClaimableGrowth),
        token1ClaimableGrowth: bigIntify(value.token1ClaimableGrowth),
        isActive: value.isActive,
      };
      return acc;
    }, limitOrderTicks);
  }

  private _computePoolAddress(token0: Address, token1: Address): Address {

    if (token0 > token1) [token0, token1] = [token1, token0];

    const encodedKey = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ['address', 'address'],
        [token0, token1],
      ),
    );

    return ethers.utils.getCreate2Address(
      this.factoryAddress,
      encodedKey,
      this.poolInitCodeHash,
    );
  }
}
