import { AsyncOrSync } from 'ts-essentials';
import {
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
} from '../../types';
import { SwapSide, Network } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { CurveSwapFunctions, CurveV1Data, CurveV1Ifaces } from './types';
import { SimpleExchange } from '../simple-exchange';
import { CurveV1Config, Adapters } from './config';
import { CurveV1EventPool } from './curve-v1-pool';
import { MIN_AMOUNT_TO_RECEIVE } from './constants';
import { Interface } from '@ethersproject/abi';
import CurveABI from '../../abi/Curve.json';

export class CurveV1 extends SimpleExchange implements IDex<CurveV1Data> {
  protected eventPools: CurveV1EventPool;

  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = false;
  readonly isFeeOnTransferSupported = true;

  readonly ifaces: CurveV1Ifaces;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(CurveV1Config);

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
  ) {
    super(dexHelper.config.data.augustusAddress, dexHelper.web3Provider);
    this.logger = dexHelper.getLogger(dexKey);
    this.eventPools = new CurveV1EventPool(
      dexKey,
      network,
      dexHelper,
      this.logger,
    );
    this.ifaces = {
      exchangeRouter: new Interface(CurveABI),
    };
  }

  async initializePricing(blockNumber: number) {
    // TODO: complete me!
    // Initialize from factory
    // Initialize from CurveAPI
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    // TODO: complete me!
    return [];
  }

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<CurveV1Data>> {
    // TODO: complete me!
    return null;
  }

  getCalldataGasCost(poolPrices: PoolPrices<CurveV1Data>): number | number[] {
    return (
      CALLDATA_GAS_COST.DEX_OVERHEAD +
      CALLDATA_GAS_COST.LENGTH_SMALL +
      CALLDATA_GAS_COST.INDEX +
      CALLDATA_GAS_COST.INDEX +
      CALLDATA_GAS_COST.TIMESTAMP +
      CALLDATA_GAS_COST.BOOL
    );
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: CurveV1Data,
    side: SwapSide,
  ): AdapterExchangeParam {
    if (side === SwapSide.BUY) throw new Error(`Buy not supported`);

    const { i, j, underlyingSwap } = data;
    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          i: 'int128',
          j: 'int128',
          deadline: 'uint256',
          underlyingSwap: 'bool',
        },
      },
      { i, j, deadline: 0, underlyingSwap },
    );

    return {
      targetExchange: data.exchange,
      payload,
      networkFee: '0',
    };
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: CurveV1Data,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    if (side === SwapSide.BUY) throw new Error(`Buy not supported`);

    const { exchange, i, j, underlyingSwap } = data;
    const defaultArgs = [i, j, srcAmount, MIN_AMOUNT_TO_RECEIVE];
    const swapMethod = underlyingSwap
      ? CurveSwapFunctions.exchange_underlying
      : CurveSwapFunctions.exchange;

    const swapData = this.ifaces.exchangeRouter.encodeFunctionData(
      swapMethod,
      defaultArgs,
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      exchange,
    );
  }

  async updatePoolState(): Promise<void> {
    // TODO: complete me!
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    //TODO: complete me!
    return [];
  }

  releaseResources(): AsyncOrSync<void> {
    // TODO: complete me!
  }
}
