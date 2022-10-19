import _ from 'lodash';
import { AsyncOrSync } from 'ts-essentials';
import { Interface, JsonFragment, AbiCoder } from '@ethersproject/abi';
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
import { MIN_AMOUNT_TO_RECEIVE } from './constants';
import { CurveV1PoolManager } from './curve-v1-pool-manager';
import CurveABI from '../../abi/Curve.json';
import FactoryCurveV1ABI from '../../abi/curve-v1/FactoryCurveV1.json';
import { addressDecode, uint256DecodeToNumber } from '../../lib/decoders';

const coder = new AbiCoder();

export class CurveV1 extends SimpleExchange implements IDex<CurveV1Data> {
  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = false;
  readonly isFeeOnTransferSupported = true;
  readonly poolManager: CurveV1PoolManager;
  readonly ifaces: CurveV1Ifaces;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(CurveV1Config);

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
    protected config = CurveV1Config[dexKey][network],
  ) {
    super(dexHelper.config.data.augustusAddress, dexHelper.web3Provider);
    this.logger = dexHelper.getLogger(dexKey);
    this.ifaces = {
      exchangeRouter: new Interface(CurveABI),
      factory: new Interface(FactoryCurveV1ABI as JsonFragment[]),
    };
    this.poolManager = new CurveV1PoolManager(
      this.dexKey,
      dexHelper.getLogger(`${this.dexKey}-state-manager`),
      dexHelper,
    );
  }

  async initializePricing(blockNumber: number) {
    // TODO: complete me!
    // Initialize from factory
    // Initialize from CurveAPI
    await this.fetchFactoryPools();
  }

  async fetchFactoryPools() {
    const { factoryAddress } = this.config;
    if (!factoryAddress) {
      this.logger.trace(
        `${this.dexKey}: No factory address specified for ${this.network}`,
      );
      return;
    }

    const poolCountResult = await this.dexHelper.multiWrapper!.tryAggregate(
      true,
      [
        {
          target: factoryAddress,
          callData: this.ifaces.factory.encodeFunctionData('pool_count'),
          decodeFunction: uint256DecodeToNumber,
        },
      ],
    );

    const poolCount = poolCountResult[0].returnData;

    const calldataGetPoolAddresses = _.range(0, poolCount).map(i => ({
      target: factoryAddress,
      callData: this.ifaces.factory.encodeFunctionData('pool_list', [i]),
      decodeFunction: addressDecode,
    }));

    const poolAddresses = (
      await this.dexHelper.multiWrapper.tryAggregate(
        true,
        calldataGetPoolAddresses,
      )
    ).map(e => e.returnData);

    const callDataAllImplementations = poolAddresses.map(p => ({
      target: factoryAddress,
      callData: this.ifaces.factory.encodeFunctionData(
        'get_implementation_address',
        [p],
      ),
      decodeFunction: addressDecode,
    }));

    const allImplementations = (
      await this.dexHelper.multiWrapper.tryAggregate(
        true,
        callDataAllImplementations,
      )
    ).map(r => r.returnData);

    console.log(0);

    // const existingPoolMap = Object.values(this.pools).reduce(
    //   (acc: { [key: string]: boolean }, p) => {
    //     acc[p.address.toLowerCase()] = true;
    //     return acc;
    //   },
    //   {},
    // );
    // const newPoolAddresses = poolAddresses.filter(
    //   (p: string) => !existingPoolMap[p],
    // );

    // const calldataGetCoins = newPoolAddresses
    //   .map((poolAddress: string) => [
    //     {
    //       target: this.factoryAddress,
    //       callData: this.factoryInterface.encodeFunctionData('get_coins', [
    //         poolAddress,
    //       ]),
    //     },
    //     {
    //       target: this.factoryAddress,
    //       callData: this.factoryInterface.encodeFunctionData(
    //         'get_underlying_coins',
    //         [poolAddress],
    //       ),
    //     },
    //   ])
    //   .flat();

    // const resultGetCoins = await this.dexHelper.multiContract.methods
    //   .tryAggregate(false, calldataGetCoins)
    //   .call();

    // newPoolAddresses.forEach((address: string, i: number) => {
    //   if (!resultGetCoins[2 * i].success) {
    //     this.logger.error('get_coins should not fail');
    //     return;
    //   }
    //   const coins = coder
    //     .decode(['address[4]'], resultGetCoins[2 * i].returnData)[0]
    //     .map((a: string) => a.toLowerCase())
    //     .filter((a: string) => a !== NULL_ADDRESS);
    //   const isMetapool = resultGetCoins[2 * i + 1].success;
    //   const underlying = isMetapool
    //     ? coder
    //         .decode(['address[8]'], resultGetCoins[2 * i + 1].returnData)[0]
    //         .map((a: string) => a.toLowerCase())
    //         .filter((a: string) => a !== NULL_ADDRESS)
    //     : [];
    //   const name = `factory_${address}`;
    //   const poolConfig: PoolConfig = {
    //     underlying,
    //     coins,
    //     address,
    //     name,
    //     type: 2,
    //     version: 3,
    //     isLending: false,
    //     isMetapool,
    //   };
    //   this.pools[name] = poolConfig;
    // });
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  getPoolIdentifier(
    poolAddress: string,
    isMeta: boolean,
    isLending: boolean,
  ): string {
    return `${this.dexKey}_${poolAddress}_${isMeta}_${isLending}`;
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
    this.poolManager.releaseResources();
  }
}
