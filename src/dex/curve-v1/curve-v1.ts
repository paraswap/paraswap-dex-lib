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
import { getBigIntPow, getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  CurveSwapFunctions,
  CurveV1Data,
  CurveV1Ifaces,
  PoolConstants,
} from './types';
import { SimpleExchange } from '../simple-exchange';
import { CurveV1Config, Adapters } from './config';
import { MIN_AMOUNT_TO_RECEIVE } from './constants';
import { CurveV1PoolManager } from './curve-v1-pool-manager';
import CurveABI from '../../abi/Curve.json';
import FactoryCurveV1ABI from '../../abi/curve-v1-factory/FactoryCurveV1.json';
import ThreePoolABI from '../../abi/curve-v1-factory/ThreePool.json';
import ERC20ABI from '../../abi/erc20.json';
import {
  addressDecode,
  generalDecoder,
  uint24ToNumber,
  uint256DecodeToNumber,
  uint8ToNumber,
} from '../../lib/decoders';
import { MultiCallParams, MultiResult } from '../../lib/multi-wrapper';
import { BytesLike } from 'ethers';
import { FactoryStateHandler } from './state-polling-pools/factory-pool-polling';
import { BasePoolPolling } from './state-polling-pools/base-pool-polling';
import { CustomBasePoolForFactory } from './state-polling-pools/custom-pool-polling';
import ImplementationConstants from './price-handlers/functions/constants';

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
      erc20: new Interface(ERC20ABI as JsonFragment[]),
      threePool: new Interface(ThreePoolABI as JsonFragment[]),
    };
    this.poolManager = new CurveV1PoolManager(
      this.dexKey,
      dexHelper.getLogger(`${this.dexKey}-state-manager`),
      dexHelper,
      this.config.stateUpdateFrequencyMs,
    );
  }

  async initializePricing(blockNumber: number) {
    // Custom pools must be initialized before factory pools!
    await this.initializeCustomPollingPools();
    await this.fetchFactoryPools();
  }

  async initializeCustomPollingPools() {
    await Promise.all(
      Object.values(this.config.customPools).map(async customPool => {
        const poolIdentifier = this.getPoolIdentifier(
          customPool.address,
          false,
          false,
        );

        const nCoins = ImplementationConstants[customPool.name].N_COINS;
        const useLending = ImplementationConstants[customPool.name].USE_LENDING;

        const COINS = (
          await this.dexHelper.multiWrapper.tryAggregate(
            true,
            _.range(nCoins).map(i => ({
              target: customPool.address,
              callData: this.ifaces.threePool.encodeFunctionData('coins', [i]),
              decodeFunction: addressDecode,
            })),
          )
        ).map(r => r.returnData);

        const coins_decimals = (
          await this.dexHelper.multiWrapper.tryAggregate(
            true,
            COINS.map(c => ({
              target: c,
              callData: this.ifaces.erc20.encodeFunctionData('decimals', []),
              decodeFunction: uint8ToNumber,
            })),
          )
        ).map(r => r.returnData);

        const poolConstants: PoolConstants = {
          COINS,
          coins_decimals,
          rate_multipliers: this._calcRateMultipliers(coins_decimals),
          lpTokenAddress: customPool.lpTokenAddress,
        };

        const newPool = new CustomBasePoolForFactory(
          this.logger,
          this.dexKey,
          customPool.name,
          customPool.address,
          poolIdentifier,
          poolConstants,
          customPool.lpTokenAddress,
          useLending,
        );

        this.poolManager.initializeNewPoolForState(poolIdentifier, newPool);
      }),
    );
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

    const callDataFromFactoryPools: MultiCallParams<
      string[] | number[] | string
    >[] = poolAddresses
      .map(p => [
        {
          target: factoryAddress,
          callData: this.ifaces.factory.encodeFunctionData(
            'get_implementation_address',
            [p],
          ),
          decodeFunction: addressDecode,
        },
        {
          target: factoryAddress,
          callData: this.ifaces.factory.encodeFunctionData('get_coins', [p]),
          decodeFunction: (result: MultiResult<BytesLike>): string[] =>
            generalDecoder<string[]>(
              result,
              ['address[4]'],
              [
                '0x0000000000000000000000000000000000000000',
                '0x0000000000000000000000000000000000000000',
                '0x0000000000000000000000000000000000000000',
                '0x0000000000000000000000000000000000000000',
              ],
              parsed => parsed.map(p => p.toLowerCase()),
            ),
        },
        {
          target: factoryAddress,
          callData: this.ifaces.factory.encodeFunctionData('get_decimals', [p]),
          decodeFunction: (result: MultiResult<BytesLike>): number[] =>
            generalDecoder<number[]>(
              result,
              ['uint256[4]'],
              [0, 0, 0, 0],
              parsed => parsed.map(p => Number(p.toString())),
            ),
        },
      ])
      .flat();

    const resultsFromFactory = (
      await this.dexHelper.multiWrapper.tryAggregate<
        string[] | number[] | string
      >(true, callDataFromFactoryPools)
    ).map(r => r.returnData);

    _.chunk(resultsFromFactory, 3).forEach((result, i) => {
      const [implementationAddress, coins, coins_decimals] = result as [
        string,
        string[],
        number[],
      ];

      const factoryImplementationFromConfig =
        this.config.factoryPoolImplementations[
          implementationAddress.toLowerCase()
        ];

      if (factoryImplementationFromConfig === undefined) {
        this.logger.error(
          `${this.dexKey}: on network ${this.dexHelper.config.data.network} ` +
            `found unspecified implementation: ${implementationAddress} for pool ${poolAddresses[i]}`,
        );
        return;
      }

      let isMeta: boolean = false;
      let basePoolStateFetcher: BasePoolPolling | undefined;
      if (factoryImplementationFromConfig.basePoolAddress !== undefined) {
        isMeta = true;
        const basePoolIdentifier = this.getPoolIdentifier(
          factoryImplementationFromConfig.basePoolAddress,
          false,
          false,
        );
        const basePool = this.poolManager.getPool(basePoolIdentifier);
        if (basePool === null) {
          this.logger.error(
            `${this.dexKey}: custom base pool was not initialized properly. ` +
              `You must call initializeCustomPollingPools before fetching factory`,
          );
          return;
        }
      }

      const poolConstants: PoolConstants = {
        COINS: coins.map(c => c.toLowerCase()),
        coins_decimals,
        rate_multipliers: this._calcRateMultipliers(coins_decimals),
      };

      const poolIdentifier = this.getPoolIdentifier(
        poolAddresses[i],
        isMeta,
        false,
      );

      const newPool = new FactoryStateHandler(
        this.logger,
        this.dexKey,
        factoryImplementationFromConfig.name,
        poolAddresses[i],
        factoryAddress,
        poolIdentifier,
        poolConstants,
        isMeta,
        basePoolStateFetcher,
      );

      this.poolManager.initializeNewPool(poolIdentifier, newPool);
    });
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

  private _calcRateMultipliers(coins_decimals: number[]): bigint[] {
    return coins_decimals.map(coinDecimal => getBigIntPow(36 - coinDecimal));
  }
}
