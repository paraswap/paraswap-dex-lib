import { Interface } from '@ethersproject/abi';
import { IDexHelper } from '../../dex-helper';
import { Address, Logger } from '../../types';
import { UniswapV3EventPool } from '../uniswap-v3/uniswap-v3-pool';
import { UniswapV3Config } from '../uniswap-v3/config';
import UniswapV3StateMulticallABI from '../../abi/uniswap-v3/UniswapV3StateMulticall.abi.json';
import { Network } from '../../constants';
import { AbiItem } from 'web3-utils';
import {
  DecodedStateMultiCallResultWithRelativeBitmaps,
  OracleObservation,
  PoolState,
} from '../uniswap-v3/types';
import { assert } from 'ts-essentials';
import { decodeStateMultiCallResultWithObservation } from './utils';
import {
  _reduceTickBitmap,
  _reduceTicks,
} from '../uniswap-v3/contract-math/utils';
import { bigIntify } from '../../utils';
import { TickBitMap } from '../uniswap-v3/contract-math/TickBitMap';
import { Observation } from './types';

export class IntegralPricing extends UniswapV3EventPool {
  private readonly providedPoolAddress: Address;
  constructor(
    readonly dexHelper: IDexHelper,
    parentName: string,
    erc20Interface: Interface,
    poolAddress: Address,
    token0: Address,
    token1: Address,
    feeCode: bigint,
    logger: Logger,
    network: Network,
    mapKey: string = '',
  ) {
    const uniswapConfig = UniswapV3Config['UniswapV3'][network];
    const stateMultiContract = new dexHelper.web3Provider.eth.Contract(
      uniswapConfig.stateMultiCallAbi !== undefined
        ? uniswapConfig.stateMultiCallAbi
        : (UniswapV3StateMulticallABI as AbiItem[]),
      uniswapConfig.stateMulticall,
    );
    super(
      dexHelper,
      parentName,
      stateMultiContract,
      undefined,
      erc20Interface,
      uniswapConfig.factory,
      feeCode,
      token0,
      token1,
      logger,
      mapKey,
      uniswapConfig.initHash,
    );
    this.providedPoolAddress = poolAddress;
  }

  get poolAddress() {
    return this.providedPoolAddress;
  }

  set poolAddress(_address: Address) {}

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

    // Quite ugly solution, but this is the one that fits to current flow.
    // I think UniswapV3 callbacks subscriptions are complexified for no reason.
    // Need to be revisited later
    assert(resState.success, 'Pool does not exist');

    const [balance0, balance1, _state] = [
      resBalance0.returnData,
      resBalance1.returnData,
      resState.returnData,
    ] as [bigint, bigint, DecodedStateMultiCallResultWithRelativeBitmaps];

    const observationsCallData = [
      ...Array(_state.slot0.observationCardinality),
    ].map((_, i) => {
      return {
        target: this.poolAddress,
        callData: this.poolIface.encodeFunctionData('observations', [i]),
        decodeFunction: decodeStateMultiCallResultWithObservation,
      };
    });

    const resObservations =
      await this.dexHelper.multiWrapper.tryAggregate<Observation>(
        false,
        observationsCallData,
        blockNumber,
        13107,
        false,
      );
    const observations = resObservations.reduce((memo, obs, i) => {
      memo[i] = {
        blockTimestamp: BigInt(obs.returnData.blockTimestamp),
        tickCumulative: BigInt(obs.returnData.tickCumulative.toString()),
        secondsPerLiquidityCumulativeX128: BigInt(
          obs.returnData.secondsPerLiquidityCumulativeX128.toString(),
        ),
        initialized: obs.returnData.initialized,
      };
      return memo;
    }, {} as { [index: number]: OracleObservation });

    const tickBitmap = {};
    const ticks = {};

    _reduceTickBitmap(tickBitmap, _state.tickBitmap);
    _reduceTicks(ticks, _state.ticks);

    const currentTick = bigIntify(_state.slot0.tick);
    const tickSpacing = bigIntify(_state.tickSpacing);

    const startTickBitmap = TickBitMap.position(currentTick / tickSpacing)[0];
    const requestedRange = this.getBitmapRangeToRequest();

    return {
      pool: _state.pool,
      blockTimestamp: bigIntify(_state.blockTimestamp),
      slot0: {
        sqrtPriceX96: bigIntify(_state.slot0.sqrtPriceX96),
        tick: currentTick,
        observationIndex: +_state.slot0.observationIndex,
        observationCardinality: +_state.slot0.observationCardinality,
        observationCardinalityNext: +_state.slot0.observationCardinalityNext,
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
      startTickBitmap,
      lowestKnownTick:
        (BigInt.asIntN(24, startTickBitmap - requestedRange) << 8n) *
        tickSpacing,
      highestKnownTick:
        ((BigInt.asIntN(24, startTickBitmap + requestedRange) << 8n) +
          BigInt.asIntN(24, 255n)) *
        tickSpacing,
      balance0,
      balance1,
    };
  }
}
