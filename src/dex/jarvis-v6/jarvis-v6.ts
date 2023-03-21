import {
  Token,
  Address,
  ExchangePrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
  PoolPrices,
} from '../../types';
import { SwapSide, Network, NULL_ADDRESS } from '../../constants';
import { getDexKeysWithNetwork, getBigIntPow } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  ChainLink,
  JarvisSwapFunctions,
  JarvisV6Data,
  JarvisV6Params,
  JarvisV6SystemMaxVars,
  PoolConfig,
  PoolState,
} from './types';
import JarvisV6PoolABI from '../../abi/jarvis/jarvis-v6-pool.json';
import AtomicSwapABI from '../../abi/jarvis/atomicSwap.json';
import { SimpleExchange } from '../simple-exchange';
import { JarvisV6Config, Adapters } from './config';
import { JarvisV6EventPool } from './jarvis-v6-events';
import {
  getJarvisPoolFromTokens,
  getJarvisSwapFunction,
  THIRTY_MINUTES,
  convertToNewDecimals,
  isSyntheticExchange,
  getJarvisPoolFromSyntheticTokens,
  inverseOf,
  getOnChainState,
  calculateTokenLiquidityInUSD,
} from './utils';
import { Interface } from '@ethersproject/abi';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import _ from 'lodash';
import { ethers } from 'ethers';

const POOL_CACHE_REFRESH_INTERVAL = 60 * 5; // 5 minutes
const poolInterface = new Interface(JarvisV6PoolABI);
const atomicSwapInterface = new Interface(AtomicSwapABI);

export class JarvisV6
  extends SimpleExchange
  implements IDex<JarvisV6Data, JarvisV6Params>
{
  protected eventPools: { [poolAddress: string]: JarvisV6EventPool } = {};

  // opt out of pool allocation as dex allows for constant price swaps
  readonly hasConstantPriceLargeAmounts = true;
  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(JarvisV6Config);

  logger: Logger;
  constructor(
    protected network: Network,
    dexKey: string,
    protected dexHelper: IDexHelper,
    protected adapters = Adapters[network],
    protected atomicSwapAddress: string = JarvisV6Config[dexKey][network]
      .atomicSwapAddress,
    protected poolConfigs: PoolConfig[] = JarvisV6Config[dexKey][network].pools,
    protected chainLinkConfigs: ChainLink = JarvisV6Config[dexKey][network]
      .chainLink,
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    const chainLinksEventsMap =
      await JarvisV6EventPool.getChainLinkSubscriberMap(
        this.chainLinkConfigs,
        this.dexKey,
        this.dexHelper,
        this.network,
        blockNumber,
      );

    await Promise.all(
      this.poolConfigs.map(async pool => {
        const poolPriceFeedPair = pool.priceFeed.map(p => p.pair);
        this.eventPools[pool.address.toLowerCase()] = new JarvisV6EventPool(
          this.dexKey,
          this.network,
          this.dexHelper,
          this.logger,
          pool,
          _.pick(chainLinksEventsMap, poolPriceFeedPair),
          poolInterface,
        );

        await this.eventPools[pool.address.toLowerCase()].initialize(
          blockNumber,
        );
      }),
    );
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

  getEventPoolFromSynthetic(syntheticToken: Token): JarvisV6EventPool | null {
    const pool = getJarvisPoolFromSyntheticTokens(
      syntheticToken,
      this.poolConfigs,
    );
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
    if (isSyntheticExchange(srcToken, destToken, this.poolConfigs)) {
      const srcEventPool = this.getEventPoolFromSynthetic(srcToken);
      const destEventPool = this.getEventPoolFromSynthetic(destToken);
      if (!srcEventPool || !destEventPool) return [];

      return [srcEventPool.getIdentifier(), destEventPool.getIdentifier()];
    }
    const eventPool = this.getEventPool(srcToken, destToken);
    if (!eventPool) return [];
    return [eventPool.getIdentifier()];
  }

  async getPoolState(
    pool: JarvisV6EventPool,
    blockNumber: number,
  ): Promise<PoolState> {
    const eventState = pool.getState(blockNumber);
    if (eventState) return eventState as PoolState;
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
    limitPools?: string[], // unusued since DEX is constant price, safe to reuse pools
  ): Promise<null | ExchangePrices<JarvisV6Data>> {
    if (side !== SwapSide.SELL) return null;
    let unit: bigint;
    let prices: bigint[];
    let poolAddresses: string[];
    let swapFunction = JarvisSwapFunctions.EXCHANGE;
    let poolIdentifier: string;
    let swapCallee: string;
    const unitVolume = getBigIntPow(srcToken.decimals);
    if (isSyntheticExchange(srcToken, destToken, this.poolConfigs)) {
      if (this.atomicSwapAddress === NULL_ADDRESS) return null;
      const srcEventPool = this.getEventPoolFromSynthetic(srcToken);
      const destEventPool = this.getEventPoolFromSynthetic(destToken);
      if (!srcEventPool || !destEventPool) return null;

      poolAddresses = [
        srcEventPool.poolConfig.address.toLowerCase(),
        destEventPool.poolConfig.address.toLowerCase(),
      ];
      swapCallee = this.atomicSwapAddress;
      poolIdentifier = `${srcEventPool.getIdentifier()}_${poolAddresses[1]}`;

      [unit, ...prices] = await this.computeExchangePoolsPrices(
        [unitVolume, ...amounts],
        poolAddresses,
        [srcEventPool, destEventPool],
        blockNumber,
      );
    } else {
      const eventPool = this.getEventPool(srcToken, destToken);
      if (!eventPool) return null;
      poolAddresses = [eventPool.poolConfig.address.toLowerCase()];
      poolIdentifier = eventPool.getIdentifier();
      swapCallee = poolAddresses[0];
      swapFunction = getJarvisSwapFunction(
        srcToken.address,
        eventPool.poolConfig,
      );

      [unit, ...prices] = await this.computeSinglePoolPrices(
        [unitVolume, ...amounts],
        poolAddresses[0],
        swapFunction,
        eventPool,
        blockNumber,
      );
    }
    return [
      {
        prices,
        unit,
        data: {
          swapFunction,
          poolAddresses,
          swapCallee,
        },
        poolAddresses,
        exchange: this.dexKey,
        gasCost: 475 * 1000, //between 450-500k gas
        poolIdentifier,
      },
    ];
  }

  async getSystemMaxVars(
    poolAddress: Address,
    blockNumber: number,
  ): Promise<JarvisV6SystemMaxVars> {
    const cacheKey = `${this.dexKey}_systemMaxVars_${poolAddress}`;
    const cachedSystemMaxVars = await this.dexHelper.cache.getAndCacheLocally(
      this.dexKey,
      this.network,
      cacheKey,
      POOL_CACHE_REFRESH_INTERVAL,
    );

    if (cachedSystemMaxVars) {
      const { maxSyntheticAvailable, maxCollateralAvailable } =
        JSON.parse(cachedSystemMaxVars);

      return {
        maxSyntheticAvailable: BigInt(maxSyntheticAvailable),
        maxCollateralAvailable: BigInt(maxCollateralAvailable),
      };
    }

    const multiContract = this.dexHelper.multiContract;
    const encodedResp = (await multiContract.methods
      .aggregate([
        {
          target: poolAddress,
          callData: poolInterface.encodeFunctionData('maxTokensCapacity', []),
        },
        {
          target: poolAddress,
          callData: poolInterface.encodeFunctionData(
            'totalSyntheticTokens',
            [],
          ),
        },
      ])
      .call({}, blockNumber)) as { returnData: [string, string] };

    const maxSyntheticAvailable = poolInterface
      .decodeFunctionResult('maxTokensCapacity', encodedResp.returnData[0])[0]
      .toString();
    const maxCollateralAvailable = poolInterface
      .decodeFunctionResult(
        'totalSyntheticTokens',
        encodedResp.returnData[1],
      )[0]
      .toString();

    const systemMaxVarStr = JSON.stringify({
      maxSyntheticAvailable,
      maxCollateralAvailable,
    });
    this.dexHelper.cache.setexAndCacheLocally(
      this.dexKey,
      this.network,
      cacheKey,
      POOL_CACHE_REFRESH_INTERVAL,
      systemMaxVarStr,
    );

    return {
      maxSyntheticAvailable: BigInt(maxSyntheticAvailable),
      maxCollateralAvailable: BigInt(maxCollateralAvailable),
    };
  }

  async computeSinglePoolPrices(
    amounts: bigint[],
    poolAddress: string,
    swapFunction: JarvisSwapFunctions,
    eventPool: JarvisV6EventPool,
    blockNumber: number,
  ) {
    const {
      poolState,
      maxSyntheticAvailable,
      maxCollateralAvailable,
      poolPrice,
    } = await this.getPoolDataForComputePrice(
      poolAddress,
      eventPool,
      blockNumber,
    );

    return amounts.map(amount => {
      if (swapFunction === JarvisSwapFunctions.MINT) {
        return this.computePriceForMint(
          amount,
          maxSyntheticAvailable,
          poolState,
          eventPool.poolConfig.collateralToken.decimals,
          poolPrice,
        );
      }

      if (amount > maxCollateralAvailable) return 0n;

      return this.computePriceForRedeem(
        amount,
        poolState,
        eventPool.poolConfig.collateralToken.decimals,
        poolPrice,
      );
    });
  }

  async computeExchangePoolsPrices(
    amounts: bigint[],
    poolAddresses: string[],
    eventPools: JarvisV6EventPool[],
    blockNumber: number,
  ) {
    const srcData = await this.getPoolDataForComputePrice(
      poolAddresses[0],
      eventPools[0],
      blockNumber,
    );
    const destData = await this.getPoolDataForComputePrice(
      poolAddresses[1],
      eventPools[1],
      blockNumber,
    );

    return amounts.map(amount => {
      if (amount > srcData.maxCollateralAvailable) return 0n;
      const srcAmountReemable = this.computePriceForRedeem(
        amount,
        srcData.poolState,
        srcData.eventPool.poolConfig.collateralToken.decimals,
        srcData.poolPrice,
      );
      return this.computePriceForMint(
        srcAmountReemable,
        destData.maxSyntheticAvailable,
        destData.poolState,
        destData.eventPool.poolConfig.collateralToken.decimals,
        destData.poolPrice,
      );
    });
  }

  async getPoolDataForComputePrice(
    poolAddress: string,
    eventPool: JarvisV6EventPool,
    blockNumber: number,
  ) {
    const poolState = await this.getPoolState(eventPool, blockNumber);
    const { maxSyntheticAvailable, maxCollateralAvailable } =
      await this.getSystemMaxVars(poolAddress, blockNumber);
    const poolPrice = await eventPool.getPoolPrice(blockNumber);
    return {
      eventPool,
      poolState,
      maxSyntheticAvailable,
      maxCollateralAvailable,
      poolPrice,
    };
  }

  computePriceForMint(
    amount: bigint,
    maxSyntheticAvailable: bigint,
    poolState: PoolState,
    collateralDecimalsNumber: number,
    pairPrice: bigint,
  ) {
    const feePercentage = poolState.pool.feesPercentage;
    const syntheticAmount = this.getSyntheticAmountToReceive(
      amount,
      collateralDecimalsNumber,
      pairPrice,
      feePercentage,
    );
    return syntheticAmount <= maxSyntheticAvailable ? syntheticAmount : 0n;
  }

  computePriceForRedeem(
    amount: bigint,
    poolState: PoolState,
    collateralDecimalsNumber: number,
    pairPrice: bigint,
  ) {
    const feePercentage = poolState.pool.feesPercentage;
    return this.getCollateralAmountToReceive(
      amount,
      collateralDecimalsNumber,
      pairPrice,
      feePercentage,
    );
  }

  getSyntheticAmountToReceive(
    collateralAmount: bigint,
    collateralDecimals: number,
    pairPrice: bigint,
    feePercentage: bigint,
  ) {
    let collateralAmountIn18Decimals = convertToNewDecimals(
      collateralAmount,
      collateralDecimals,
      18,
    );
    return (
      ((collateralAmountIn18Decimals -
        (collateralAmountIn18Decimals * feePercentage) / getBigIntPow(18)) *
        inverseOf(pairPrice)) /
      getBigIntPow(18)
    );
  }

  getCollateralAmountToReceive(
    syntheticAmount: bigint,
    collateralDecimals: number,
    pairPrice: bigint,
    feePercentage: bigint,
  ) {
    const result =
      (syntheticAmount * pairPrice) / getBigIntPow(18) -
      (((syntheticAmount * pairPrice) / getBigIntPow(18)) * feePercentage) /
        getBigIntPow(18);
    if (collateralDecimals === 18) return result;
    return convertToNewDecimals(result, 18, collateralDecimals);
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
    const { swapFunction, swapCallee } = data;
    const type = [
      JarvisSwapFunctions.MINT,
      JarvisSwapFunctions.REDEEM,
      JarvisSwapFunctions.EXCHANGE,
    ].indexOf(swapFunction);

    if (type === undefined) {
      throw new Error(
        `Jarvis: Invalid OpType ${swapFunction}, Should be one of ['mint', 'redeem', 'exchangeSynthTokens']`,
      );
    }

    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          opType: 'uint',
          expiration: 'uint128',
        },
      },
      {
        opType: type,
        expiration: (Date.now() / 1000 + THIRTY_MINUTES).toFixed(0),
      },
    );

    return {
      targetExchange: swapCallee.toLowerCase(),
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
    const { swapFunction, swapCallee, poolAddresses } = data;
    const timestamp = (Date.now() / 1000 + THIRTY_MINUTES).toFixed(0);

    let swapData: string;

    switch (swapFunction) {
      case JarvisSwapFunctions.MINT:
        swapData = poolInterface.encodeFunctionData(swapFunction, [
          ['1', srcAmount, timestamp, this.augustusAddress],
        ]);

        break;
      case JarvisSwapFunctions.REDEEM:
        swapData = poolInterface.encodeFunctionData(swapFunction, [
          [srcAmount, '1', timestamp, this.augustusAddress],
        ]);

        break;
      case JarvisSwapFunctions.EXCHANGE:
        const redeemEncodedData = ethers.utils.defaultAbiCoder.encode(
          ['uint8', 'address', 'tuple(uint256, uint256, uint256, address)'],
          [
            '0',
            poolAddresses[0].toLowerCase(),
            [srcAmount, '1', timestamp, this.atomicSwapAddress],
          ],
        );
        const mintEncodedData = ethers.utils.defaultAbiCoder.encode(
          ['uint8', 'address', 'tuple(uint256, uint256, uint256, address)'],
          [
            '1',
            poolAddresses[1].toLowerCase(),
            ['1', '1', timestamp, this.augustusAddress],
          ],
        );
        swapData = atomicSwapInterface.encodeFunctionData('multiOperations', [
          [
            ['2', redeemEncodedData],
            ['1', mintEncodedData],
          ],
        ]);
        break;
      default:
        throw new Error(`Unknown function ${swapFunction}`);
    }

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      swapCallee,
    );
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    _tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    const tokenAddress = _tokenAddress.toLowerCase();

    const possiblePools = this.poolConfigs.filter(
      pool =>
        pool.collateralToken.address.toLowerCase() === tokenAddress ||
        pool.syntheticToken.address.toLowerCase() === tokenAddress,
    );
    const { maxPoolsLiquidity, chainlinkPriceFeeds } = await getOnChainState(
      this.dexHelper.multiContract,
      this.chainLinkConfigs,
      possiblePools,
      'latest',
    );

    return possiblePools
      .map(p => {
        const isSynthetic =
          p.collateralToken.address.toLowerCase() === tokenAddress;
        const liquidityUSD = parseInt(
          (
            calculateTokenLiquidityInUSD(
              p,
              maxPoolsLiquidity[p.address],
              chainlinkPriceFeeds,
              isSynthetic,
            ) / getBigIntPow(18)
          ).toString(),
        );
        return {
          exchange: this.dexKey,
          address: p.address,
          connectorTokens: [isSynthetic ? p.collateralToken : p.syntheticToken],
          liquidityUSD,
        };
      })
      .sort((a, b) => b.liquidityUSD - a.liquidityUSD)
      .slice(0, limit);
  }

  getCalldataGasCost(poolPrices: PoolPrices<JarvisV6Data>): number | number[] {
    return (
      CALLDATA_GAS_COST.DEX_OVERHEAD +
      CALLDATA_GAS_COST.LENGTH_SMALL +
      // opType
      CALLDATA_GAS_COST.INDEX +
      // expiration
      CALLDATA_GAS_COST.TIMESTAMP
    );
  }
}
