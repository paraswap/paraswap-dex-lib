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
import { getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  DexParams,
  JarvisSwapFunctions,
  JarvisV6Data,
  JarvisV6Params,
  PoolConfig,
  PoolState,
  priceFeedData,
} from './types';
import { SimpleExchange } from '../simple-exchange';
import { JarvisV6Config, Adapters } from './config';
import { JarvisV6EventPool } from './jarvis-v6-events';
import {
  getJarvisPoolFromTokens,
  getJarvisSwapFunction,
  getOnChainState,
  THIRTY_MINUTES,
  toNewDecimal,
} from './utils';
import { Interface } from '@ethersproject/abi';
import { BI_POWS } from '../../bigint-constants';

export class JarvisV6
  extends SimpleExchange
  implements IDex<JarvisV6Data, JarvisV6Params>
{
  protected eventPools: { [poolAddress: string]: JarvisV6EventPool };

  readonly hasConstantPriceLargeAmounts = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(JarvisV6Config);

  logger: Logger;
  constructor(
    protected network: Network,
    protected dexKey: string,
    protected dexHelper: IDexHelper,
    protected adapters = Adapters[network],
    protected poolInterface: Interface = JarvisV6Config[dexKey][network]
      .poolInterface,
    protected poolConfigs: PoolConfig[] = JarvisV6Config[dexKey][network].pools,
    protected priceFeed: priceFeedData = JarvisV6Config[dexKey][network]
      .priceFeed,
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
          this.priceFeed,
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
      this.priceFeed.address,
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

    const poolIdentifier = eventPool.getIdentifier();
    if (limitPools && !limitPools.includes(poolIdentifier)) return null;

    const poolState = await this.getPoolState(eventPool, blockNumber);

    const swapFunction = getJarvisSwapFunction(srcToken, eventPool.poolConfig);
    const pool = eventPool.poolConfig;
    const feePercentage = poolState.pool.feesPercentage;
    const UsdcPriceFeed = poolState.priceFeed.usdcPrice;

    const prices = amounts.map(amount => {
      if (swapFunction === JarvisSwapFunctions.mint) {
        if (side === SwapSide.SELL)
          return this.getSyntheticAmountToReceive(
            amount,
            pool.collateralToken.decimals,
            UsdcPriceFeed,
            feePercentage,
          );
        return this.getCollateralAmountToReceive(
          amount,
          pool.collateralToken.decimals,
          UsdcPriceFeed,
          feePercentage,
        );
      }
      if (swapFunction === JarvisSwapFunctions.redeem) {
        if (side === SwapSide.SELL)
          return this.getCollateralAmountToReceive(
            amount,
            pool.collateralToken.decimals,
            UsdcPriceFeed,
            feePercentage,
          );
        return this.getSyntheticAmountToReceive(
          amount,
          pool.collateralToken.decimals,
          UsdcPriceFeed,
          feePercentage,
        );
      }
      return 0n;
    });

    const unit =
      swapFunction === JarvisSwapFunctions.mint
        ? (1n * BI_POWS[18] * BI_POWS[18]) / UsdcPriceFeed
        : UsdcPriceFeed;

    return [
      {
        prices, // [ amount final après priceFeed]
        unit,
        data: {
          swapFunction,
          poolAddress: eventPool.poolConfig.address,
        },
        poolAddresses: [eventPool.poolConfig.address],
        exchange: this.dexKey,
        gasCost: 500 * 1000, //TODO: simulate and fix the gas cost
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
    const type = [JarvisSwapFunctions.mint, JarvisSwapFunctions.redeem].indexOf(
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
        destPool: data.poolAddress || NULL_ADDRESS,
        expiration: (Date.now() / 1000 + THIRTY_MINUTES).toFixed(0),
      },
    );

    return {
      targetExchange: data.poolAddress,
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
      case JarvisSwapFunctions.mint:
        swapFunctionParams = [
          destAmount,
          srcAmount,
          timestamp,
          this.augustusAddress,
        ];
        break;
      case JarvisSwapFunctions.redeem:
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
      data.poolAddress,
    );
  }

  // This is called once before getTopPoolsForToken is
  // called for multiple tokens. This can be helpful to
  // update common state required for calculating
  // getTopPoolsForToken. It is optional for a DEX
  // to implement this
  async updatePoolState(): Promise<void> {
    // TODO: complete me!
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    return [];
  }

  getSyntheticAmountToReceive(
    collateralAmount: bigint,
    collateralDecimals: number,
    UsdcPriceFeed: bigint,
    feePercentage: bigint,
  ) {
    let collateralAmountIn18Decimals = toNewDecimal(
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
    return toNewDecimal(result, 18, collateralDecimals);
  }
}
