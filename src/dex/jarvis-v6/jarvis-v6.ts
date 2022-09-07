import {
  Token,
  Address,
  ExchangePrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
} from '../../types';
import { SwapSide, Network, NULL_ADDRESS } from '../../constants';
import { getDexKeysWithNetwork, getBigIntPow } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  JarvisSwapFunctions,
  JarvisV6Data,
  JarvisV6Params,
  PoolConfig,
  PoolState,
} from './types';
import JarvisV6PoolABI from '../../abi/jarvis/jarvis-v6-pool.json';
import { SimpleExchange } from '../simple-exchange';
import { JarvisV6Config, Adapters } from './config';
import { JarvisV6EventPool } from './jarvis-v6-events';
import {
  getJarvisPoolFromTokens,
  getJarvisSwapFunction,
  getOnChainState,
  THIRTY_MINUTES,
  convertToNewDecimals,
} from './utils';
import { Interface } from '@ethersproject/abi';
import { BI_POWS } from '../../bigint-constants';

const POOL_CACHE_REFRESH_INTERVAL = 60 * 5; // 5 minutes

export class JarvisV6
  extends SimpleExchange
  implements IDex<JarvisV6Data, JarvisV6Params>
{
  protected eventPools: { [poolAddress: string]: JarvisV6EventPool };

  readonly hasConstantPriceLargeAmounts = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(JarvisV6Config);

  protected poolInterface: Interface = new Interface(JarvisV6PoolABI);

  logger: Logger;
  constructor(
    protected network: Network,
    protected dexKey: string,
    protected dexHelper: IDexHelper,
    protected adapters = Adapters[network],
    protected poolConfigs: PoolConfig[] = JarvisV6Config[dexKey][network].pools,
    protected priceFeedAddress: Address = JarvisV6Config[dexKey][network]
      .priceFeedAddress,
  ) {
    super(dexHelper.config.data.augustusAddress, dexHelper.web3Provider);
    this.logger = dexHelper.getLogger(dexKey);
    this.eventPools = {};

    poolConfigs.forEach(
      pool =>
        (this.eventPools[pool.address.toLowerCase()] = new JarvisV6EventPool(
          dexKey,
          network,
          dexHelper,
          this.logger,
          pool,
          this.priceFeedAddress,
          this.poolInterface,
        )),
    );
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    const poolStates = await getOnChainState(
      this.dexHelper,
      this.priceFeedAddress,
      this.poolConfigs,
      this.poolInterface,
      blockNumber,
    );

    this.poolConfigs.forEach((pool, index) => {
      const eventPool = this.eventPools[pool.address.toLowerCase()];
      eventPool.setState(poolStates[index], blockNumber);
      this.dexHelper.blockManager.subscribeToLogs(
        eventPool,
        eventPool.addressesSubscribed,
        blockNumber,
      );
    });
  }

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side];
  }

  getEventPool(srcToken: Token, destToken: Token): JarvisV6EventPool | null {
    const pool = getJarvisPoolFromTokens(srcToken, destToken, this.poolConfigs);
    return this.eventPools[pool?.address.toLowerCase()!];
  }

  // Returns list of pool identifiers that can be used
  // for a given swap. poolIdentifiers must be unique
  // across DEXes. It is recommended to use
  // ${dexKey}_${poolAddress} as a poolIdentifier
  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    const eventPool = this.getEventPool(srcToken, destToken);
    if (!eventPool) return [];
    return [eventPool.getIdentifier()];
  }

  async getPoolState(
    pool: JarvisV6EventPool,
    blockNumber: number,
  ): Promise<PoolState> {
    const eventState = pool.getState(blockNumber);
    if (eventState) return eventState;
    const onChainState = await pool.generateState(blockNumber);
    pool.setState(onChainState, blockNumber);
    return onChainState;
  }

  // Returns pool prices for amounts.
  // If limitPools is defined only pools in limitPools
  // should be used. If limitPools is undefined then
  // any pools can be used.
  // Pair
  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<JarvisV6Data>> {
    const eventPool = this.getEventPool(srcToken, destToken);

    if (!eventPool) return null;
    const poolAddress = eventPool.poolConfig.address.toLowerCase();
    const poolIdentifier = eventPool.getIdentifier();
    if (limitPools && !limitPools.includes(poolIdentifier)) return null;

    const poolState = await this.getPoolState(eventPool, blockNumber);

    const unitVolume = getBigIntPow(
      (side === SwapSide.SELL ? srcToken : destToken).decimals,
    );

    const swapFunction = getJarvisSwapFunction(srcToken, eventPool.poolConfig);
    const maxTokensCapacity = await this.getMaxTokensCapacity(
      poolAddress,
      blockNumber,
    );

    const [unit, ...prices] = this.computePrices(
      [unitVolume, ...amounts],
      swapFunction,
      maxTokensCapacity,
      side,
      eventPool.poolConfig,
      poolState,
    );

    return [
      {
        prices,
        unit,
        data: {
          swapFunction,
          poolAddress,
        },
        poolAddresses: [poolAddress],
        exchange: this.dexKey,
        gasCost: 475 * 1000, //between 450-500k gas
        poolIdentifier,
      },
    ];
  }

  // Encode params required by the exchange adapter
  // Used for multiSwap, buy & megaSwap
  // Hint: abiCoder.encodeParameter() could be useful
  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: JarvisV6Data,
    side: SwapSide,
  ): AdapterExchangeParam {
    const { swapFunction } = data;
    const type = [JarvisSwapFunctions.MINT, JarvisSwapFunctions.REDEEM].indexOf(
      swapFunction,
    );

    if (type === undefined) {
      throw new Error(
        `Jarvis: Invalid OpType ${swapFunction}, Should be one of ['mint', 'redeem']`,
      );
    }

    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          opType: 'uint',
          destPool: 'address',
          expiration: 'uint128',
        },
      },
      {
        opType: type,
        destPool: data.poolAddress.toLowerCase() || NULL_ADDRESS,
        expiration: (Date.now() / 1000 + THIRTY_MINUTES).toFixed(0),
      },
    );

    return {
      targetExchange: data.poolAddress.toLowerCase(),
      payload,
      networkFee: '0',
    };
  }

  // Encode call data used by simpleSwap like routers
  // Used for simpleSwap & simpleBuy
  // Hint: this.buildSimpleParamWithoutWETHConversion
  // could be useful
  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: JarvisV6Data,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const { swapFunction } = data;
    const timestamp = (Date.now() / 1000 + THIRTY_MINUTES).toFixed(0);

    let swapFunctionParams: JarvisV6Params;
    switch (swapFunction) {
      case JarvisSwapFunctions.MINT:
        swapFunctionParams = [
          destAmount,
          srcAmount,
          timestamp,
          this.augustusAddress,
        ];
        break;
      case JarvisSwapFunctions.REDEEM:
        swapFunctionParams = [
          srcAmount,
          destAmount,
          timestamp,
          this.augustusAddress,
        ];
        break;
      default:
        throw new Error(`Unknown function ${swapFunction}`);
    }
    const swapData = this.poolInterface.encodeFunctionData(swapFunction, [
      swapFunctionParams,
    ]);

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      data.poolAddress.toLowerCase(),
    );
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    return [];
  }

  async getMaxTokensCapacity(
    poolAddress: Address,
    blockNumber: number,
  ): Promise<bigint> {
    const cacheKey = `${this.dexKey}_maxTokensCapacity_${poolAddress}`;
    const cachedMaxTokensCapacity = await this.dexHelper.cache.get(
      this.dexKey,
      this.network,
      cacheKey,
    );

    if (cachedMaxTokensCapacity) {
      this.logger.info(
        `Got maxTokensCapacity of ${this.dexKey}_${poolAddress} pool from cache`,
      );
      return BigInt(cachedMaxTokensCapacity);
    }

    this.logger.info(
      `Get ${this.dexKey}_${this.network} MaxTokensCapacity from pool : ${poolAddress}`,
    );

    const poolContractInstance = new this.dexHelper.web3Provider.eth.Contract(
      JarvisV6PoolABI as any,
      poolAddress,
    );

    const maxTokensCapacity = await poolContractInstance.methods
      .maxTokensCapacity()
      .call({}, blockNumber);

    if (!maxTokensCapacity)
      throw new Error('Unable to get maxTokensCapacity from contract pool');

    this.logger.info(
      `Got maxTokensCapacity ${this.dexKey}_${this.network} from pool : ${poolAddress}`,
    );
    this.dexHelper.cache.setex(
      this.dexKey,
      this.network,
      cacheKey,
      POOL_CACHE_REFRESH_INTERVAL,
      maxTokensCapacity,
    );

    return BigInt(maxTokensCapacity);
  }

  computePrices(
    amounts: bigint[],
    swapFunction: JarvisSwapFunctions,
    maxTokensCapacity: bigint,
    side: SwapSide,
    pool: PoolConfig,
    poolState: PoolState,
  ): bigint[] {
    return amounts.map(amount => {
      if (swapFunction === JarvisSwapFunctions.MINT) {
        return this.computePriceForMint(
          amount,
          maxTokensCapacity,
          side,
          poolState,
          pool.collateralToken.decimals,
        );
      }
      if (swapFunction === JarvisSwapFunctions.REDEEM) {
        return this.computePriceForRedeem(
          amount,
          side,
          poolState,
          pool.collateralToken.decimals,
        );
      }
      return 0n;
    });
  }

  computePriceForMint(
    amount: bigint,
    maxTokensCapacity: bigint,
    side: SwapSide,
    poolState: PoolState,
    collateralDecimalsNumber: number,
  ) {
    const feePercentage = poolState.pool.feesPercentage;
    const UsdcPriceFeed = poolState.priceFeed.usdcPrice;
    if (side === SwapSide.SELL) {
      const syntheticAmount = this.getSyntheticAmountToReceive(
        amount,
        collateralDecimalsNumber,
        UsdcPriceFeed,
        feePercentage,
      );
      return syntheticAmount <= maxTokensCapacity ? syntheticAmount : 0n;
    }

    if (maxTokensCapacity <= amount) return 0n;
    return this.getCollateralAmountToReceive(
      amount,
      collateralDecimalsNumber,
      UsdcPriceFeed,
      feePercentage,
    );
  }

  computePriceForRedeem(
    amount: bigint,
    side: SwapSide,
    poolState: PoolState,
    collateralDecimalsNumber: number,
  ) {
    const feePercentage = poolState.pool.feesPercentage;
    const UsdcPriceFeed = poolState.priceFeed.usdcPrice;
    if (side === SwapSide.SELL) {
      return this.getCollateralAmountToReceive(
        amount,
        collateralDecimalsNumber,
        UsdcPriceFeed,
        feePercentage,
      );
    }
    return this.getSyntheticAmountToReceive(
      amount,
      collateralDecimalsNumber,
      UsdcPriceFeed,
      feePercentage,
    );
  }

  getSyntheticAmountToReceive(
    collateralAmount: bigint,
    collateralDecimals: number,
    UsdcPriceFeed: bigint,
    feePercentage: bigint,
  ) {
    let collateralAmountIn18Decimals = convertToNewDecimals(
      collateralAmount,
      collateralDecimals,
      18,
    );
    return (
      ((collateralAmountIn18Decimals -
        (collateralAmountIn18Decimals * feePercentage) / BI_POWS[18]) *
        BI_POWS[18]) /
      UsdcPriceFeed
    );
  }

  getCollateralAmountToReceive(
    syntheticAmount: bigint,
    collateralDecimals: number,
    UsdcPriceFeed: bigint,
    feePercentage: bigint,
  ) {
    const result =
      (syntheticAmount * UsdcPriceFeed) / BI_POWS[18] -
      (((syntheticAmount * UsdcPriceFeed) / BI_POWS[18]) * feePercentage) /
        BI_POWS[18];
    if (collateralDecimals === 18) return result;
    return convertToNewDecimals(result, 18, collateralDecimals);
  }
}
