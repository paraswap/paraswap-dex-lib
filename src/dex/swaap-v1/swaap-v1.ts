import { Interface } from '@ethersproject/abi';
import {
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
  MultiCallInput,
} from '../../types';
import { SwapSide, Network, MAX_INT, MAX_UINT } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getDexKeysWithNetwork, getBigIntPow } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { ChainLinkSubscriber } from '../../lib/chainlink';
import {
  DexParams,
  SwaapV1Data,
  SwaapV1PoolState,
  SubgraphPoolBase,
  SwaapV1ProxySwapArguments,
  SwaapV1PoolSwapArguments,
  SwaapV1Swap,
} from './types';
import { SimpleExchange } from '../simple-exchange';
import {
  SwaapV1Config,
  Adapters,
  SUBGRAPH_FETCH_ALL_POOOLS_RQ,
  SUBGRAPH_TIMEOUT,
  MAX_POOL_CNT,
  POOL_CACHE_TTL,
  MAX_GAS_COST_ESTIMATION,
  RECCURING_POOL_FETCH_INTERVAL_MS,
} from './config';
import { SwaapV1Pool } from './swaap-v1-pool';
import PoolABI from '../../abi/swaap-v1/pool.json';
import { PoolQuotations } from './libraries/PoolQuotations';

export class SwaapV1 extends SimpleExchange implements IDex<SwaapV1Data> {
  static readonly poolInterface = new Interface(PoolABI);

  protected config: DexParams;
  protected subgraphURL: string;
  protected exchangeProxy: string;

  protected eventPools: { [poolAddress: string]: SwaapV1Pool } = {};

  readonly hasConstantPriceLargeAmounts = false;
  readonly isFeeOnTransferSupported: boolean = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(SwaapV1Config);

  logger: Logger;

  constructor(
    protected network: Network,
    protected dexKey: string,
    protected dexHelper: IDexHelper,
    protected adapters = Adapters[network], // TODO: add any additional optional params to support other fork DEXes
  ) {
    super(dexHelper.config.data.augustusAddress, dexHelper.web3Provider);
    this.config = SwaapV1Config[dexKey][network];
    this.logger = dexHelper.getLogger(`${dexKey}-${network}`);
    this.subgraphURL = this.config.subgraphURL;
    this.exchangeProxy = this.config.exchangeProxy;
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    await this.getPools(blockNumber, true);
    setInterval(
      () => this.getPools(null, false),
      RECCURING_POOL_FETCH_INTERVAL_MS,
    );
  }

  async getPools(_blockNumber: number | null, init: boolean) {
    const blockNumber = _blockNumber
      ? _blockNumber
      : await this.dexHelper.provider.getBlockNumber();
    const allPools = await this.fetchAllSubgraphPools(blockNumber);
    if (!allPools)
      if (init) {
        throw new Error(
          'initializePricing: SwaapV1 cfgInfo still null after init',
        );
      }
    for (const poolConfig of allPools.values()) {
      if (
        init ||
        !Object.values(this.eventPools)
          .map(e => e.id)
          .includes(poolConfig.id)
      ) {
        await this.addPool(poolConfig, blockNumber);
      }
    }
  }

  async addPool(poolConfig: SubgraphPoolBase, blockNumber: number) {
    const pool = new SwaapV1Pool(
      this.dexKey,
      this.network,
      poolConfig,
      this.dexHelper,
    );
    const state = await pool.generateState(blockNumber);
    pool.setState(state, blockNumber);

    this.dexHelper.blockManager.subscribeToLogs(
      pool,
      pool.addressSubscribers,
      blockNumber,
    );
    this.eventPools[poolConfig.id] = pool;
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<SwaapV1Data>): number | number[] {
    // TODO: update if there is any payload in getAdapterParam
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side];
  }

  protected findPools(
    srcTokenAddress: Address,
    destTokenAddress: Address,
  ): Address[] {
    if (!this.eventPools) return [];
    return Object.values(this.eventPools)
      .filter(poolConfig => {
        return (
          poolConfig.tokens.includes(srcTokenAddress) &&
          poolConfig.tokens.includes(destTokenAddress)
        );
      })
      .map(p => p.id);
  }

  protected getPoolIdentifier(poolAddress: Address): string {
    return `${this.dexKey}_${poolAddress}`;
  }

  // Returns list of pool identifiers that can be used
  // for a given swap. poolIdentifers must be unique
  // across DEXes. It is recommended to use
  // ${dexKey}_${poolAddress} as a poolIdentifier
  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    return this.findPools(
      srcToken.address.toLowerCase(),
      destToken.address.toLowerCase(),
    ).map(p => this.getPoolIdentifier(p));
  }

  // Encode params required by the exchange adapter
  // Used for multiSwap, buy & megaSwap
  // Hint: abiCoder.encodeParameter() couls be useful
  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: SwaapV1Data,
    side: SwapSide,
  ): AdapterExchangeParam {
    return {
      targetExchange: data.pool,
      payload: '0x',
      networkFee: '0',
    };
  }

  private getSwaapV1Param(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: SwaapV1Data,
    side: SwapSide,
  ): [SwaapV1PoolSwapArguments, string] {
    let functionName;
    let limitAmount;
    let amountIn;
    let amountOut;
    if (side == SwapSide.SELL) {
      functionName = 'swapExactAmountInMMM';
      limitAmount = MAX_INT;
      amountIn = BigInt(srcAmount);
      amountOut = BigInt(0);
    } else {
      functionName = 'swapExactAmountOutMMM';
      limitAmount = MAX_INT;
      amountIn = BigInt(MAX_UINT);
      amountOut = BigInt(destAmount);
    }

    const params: SwaapV1PoolSwapArguments = [
      srcToken,
      BigInt(amountIn),
      destToken,
      BigInt(amountOut),
      BigInt(MAX_UINT),
    ];

    return [params, functionName];
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
    data: SwaapV1Data,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const [params, functionName] = this.getSwaapV1Param(
      srcToken,
      destToken,
      srcAmount,
      destAmount,
      data,
      side,
    );
    const swapData = SwaapV1.poolInterface.encodeFunctionData(
      functionName,
      params,
    );
    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      data.pool,
    );
  }

  // // Returns list of top pools based on liquidity. Max
  // // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    count: number,
  ): Promise<PoolLiquidity[]> {
    return this.getTopPoolsForTokens([tokenAddress], count, null).then(
      pools =>
        pools.map((pool: SubgraphPoolBase) => {
          return {
            exchange: this.dexKey,
            address: pool.id.toLowerCase(),
            connectorTokens: pool.tokens.reduce(
              (
                acc: Token[],
                { decimals, address }: { decimals: number; address: string },
              ) => {
                if (address.toLowerCase() != tokenAddress.toLowerCase()) {
                  acc.push({ decimals, address: address.toLowerCase() });
                }
                return acc;
              },
              [],
            ),
            liquidityUSD: Number(pool.liquidityUSD),
          };
        }),
      _ => [],
    );
  }

  // // Returns list of top pools based on liquidity. Max
  // // limit number pools should be returned.
  async getTopPoolsForTokens(
    tokenAddresses: Address[],
    count: number,
    blockNumber: number | null,
  ): Promise<SubgraphPoolBase[]> {
    const variables = {
      tokens: tokenAddresses,
      count,
    };
    const query = `query ($tokens: [Bytes!], $count: Int) {
      pools (first: $count, orderBy: liquidity, orderDirection: desc,
           where: {tokensList_contains: $tokens,
                   finalized: true,
                   liquidity_gt: 0}) {
        id
        liquidityUSD: liquidity
        tokens {
          address
          decimals
        }
      }
    }`;
    const { data } = await this.dexHelper.httpRequest.post(
      this.subgraphURL,
      {
        query,
        variables,
      },
      SUBGRAPH_TIMEOUT,
    );

    if (!(data && data.pools))
      throw new Error(
        `Error_${this.dexKey}_Subgraph: couldn't fetch the pools from the subgraph`,
      );

    return data.pools.map((pool: SubgraphPoolBase) => {
      const castedPool = SwaapV1.castSubgraphPoolBase(pool);
      if (
        blockNumber &&
        !Object.values(this.eventPools)
          .map(e => e.id)
          .includes(castedPool.id)
      ) {
        this.addPool(castedPool, blockNumber!);
      }
      return castedPool;
    });
  }

  static castSubgraphPoolBase(pool: SubgraphPoolBase): SubgraphPoolBase {
    return {
      ...pool,
      liquidityUSD: Number(pool.liquidityUSD),
      swapFee: Number(pool.swapFee),
      dynamicCoverageFeesZ: Number(pool.dynamicCoverageFeesZ),
      dynamicCoverageFeesHorizon: Number(pool.dynamicCoverageFeesHorizon),
      priceStatisticsLookbackInSec: Number(pool.priceStatisticsLookbackInSec),
      maxPriceUnpegRatio: Number(pool.maxPriceUnpegRatio),
    };
  }

  async fetchAllSubgraphPools(
    blockNumber: number,
  ): Promise<Map<string, SubgraphPoolBase>> {
    const cacheKey = 'AllSubgraphPools';
    const cachedPools = await this.dexHelper.cache.get(
      this.dexKey,
      this.network,
      cacheKey,
    );
    if (cachedPools) {
      const allPools = JSON.parse(cachedPools);
      this.logger.info(
        `Got ${allPools.length} ${this.dexKey}_${this.network} pools from cache`,
      );
      return allPools;
    }

    this.logger.info(
      `Fetching ${this.dexKey}_${this.network} Pools from subgraph`,
    );
    const variables = {
      count: MAX_POOL_CNT,
    };
    const { data } = await this.dexHelper.httpRequest.post(
      this.subgraphURL,
      { query: SUBGRAPH_FETCH_ALL_POOOLS_RQ, variables },
      SUBGRAPH_TIMEOUT,
    );
    if (!(data && data.pools))
      throw new Error('Unable to fetch pools from the subgraph');

    this.dexHelper.cache.setex(
      this.dexKey,
      this.network,
      cacheKey,
      POOL_CACHE_TTL,
      JSON.stringify(data.pools),
    );
    const allPools = await SwaapV1.initPools(
      this.dexHelper,
      blockNumber,
      data.pools,
    );

    this.logger.info(
      `Got ${allPools.size} ${this.dexKey}_${this.network} pools from subgraph`,
    );
    return allPools;
  }

  static async initPools(
    dexHelper: IDexHelper,
    blockNumber: number,
    allPools: SubgraphPoolBase[],
  ): Promise<Map<string, SubgraphPoolBase>> {
    // aggregators
    let inputs: any = allPools
      .map((pool: SubgraphPoolBase) => {
        return pool.tokens.map(t =>
          ChainLinkSubscriber.getReadAggregatorMultiCallInput(
            t.oracleInitialState.proxy,
          ),
        );
      })
      .flat();
    let returnData = (
      await dexHelper.multiContract.methods
        .aggregate(inputs)
        .call({}, blockNumber)
    ).returnData;
    let idx: number = 0;
    allPools.forEach((pool: SubgraphPoolBase) => {
      pool.tokens.forEach(token => {
        const aggregator: Address = ChainLinkSubscriber.proxyInterface
          .decodeFunctionResult('aggregator', returnData[idx++])[0]
          .toLowerCase();
        token.oracleInitialState.aggregator = aggregator;
      });
    });

    return allPools.reduce(
      (acc: Map<string, SubgraphPoolBase>, pool: SubgraphPoolBase) => {
        return acc.set(pool.id, {
          ...SwaapV1.castSubgraphPoolBase(pool),
        });
      },
      new Map<string, SubgraphPoolBase>(),
    );
  }

  getPricesPool(
    from: Address,
    to: Address,
    unitVolume: bigint,
    amounts: bigint[],
    side: SwapSide,
    state: SwaapV1PoolState,
    currentTimestamp: bigint,
  ): [bigint, bigint[]] {
    if (side === SwapSide.SELL) {
      let unitAmountOut: bigint;
      try {
        unitAmountOut = PoolQuotations.getAmountOutGivenInMMM(
          state.liquidities[from],
          state.oracles[from],
          unitVolume,
          state.liquidities[to],
          state.oracles[to],
          state.parameters,
          currentTimestamp,
        );
      } catch (e) {
        this.logger.error('Failed to get historical round data', e);
        unitAmountOut = 0n;
      }

      const amountsOut: bigint[] = amounts.map(amountIn => {
        try {
          return PoolQuotations.getAmountOutGivenInMMM(
            state.liquidities[from],
            state.oracles[from],
            amountIn,
            state.liquidities[to],
            state.oracles[to],
            state.parameters,
            currentTimestamp,
          );
        } catch (e) {
          return 0n;
        }
      });

      return [unitAmountOut, amountsOut];
    } else {
      let unitAmountIn;
      try {
        unitAmountIn = PoolQuotations.getAmountInGivenOutMMM(
          state.liquidities[from],
          state.oracles[from],
          state.liquidities[to],
          state.oracles[to],
          unitVolume,
          state.parameters,
          currentTimestamp,
        );
      } catch (e) {
        unitAmountIn = BigInt(MAX_UINT);
      }

      const amountsIn = amounts.map(amountOut => {
        try {
          return PoolQuotations.getAmountInGivenOutMMM(
            state.liquidities[from],
            state.oracles[from],
            state.liquidities[to],
            state.oracles[to],
            amountOut,
            state.parameters,
            currentTimestamp,
          );
        } catch (e) {
          return BigInt(MAX_UINT);
        }
      });
      return [unitAmountIn, amountsIn];
    }
  }

  // Returns pool prices for amounts.
  // If limitPools is defined only pools in limitPools
  // should be used. If limitPools is undefined then
  // any pools can be used.
  getPricesVolume(
    _from: Token,
    _to: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<SwaapV1Data>> {
    return this.getPricesVolumeLogic(
      _from,
      _to,
      amounts,
      side,
      blockNumber,
      null,
      limitPools,
    );
  }

  async getPricesVolumeLogic(
    _from: Token,
    _to: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    _currentTimeStamp: bigint | null,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<SwaapV1Data>> {
    const from = this.dexHelper.config.wrapETH(_from);
    const to = this.dexHelper.config.wrapETH(_to);

    const srcTokenAddress = from.address.toLowerCase();
    const destTokenAddress = to.address.toLowerCase();

    const topPools: Address[] = this.findPools(
      srcTokenAddress,
      destTokenAddress,
    );

    const allowedPools = limitPools
      ? topPools.filter((p: Address) =>
          limitPools.includes(`${this.dexKey}_${p.toLowerCase()}`),
        )
      : topPools;

    if (!allowedPools.length) return null;

    const unitVolume = getBigIntPow(
      (side === SwapSide.SELL ? from : to).decimals,
    );

    if (srcTokenAddress === destTokenAddress) return null;
    const currentTimestamp =
      _currentTimeStamp || BigInt(Math.floor(Date.now() / 1000)); // the on-chain pricing logic is not too much sensitive to that value
    return await Promise.all(
      allowedPools.map(async poolAddress => {
        let state = this.eventPools[poolAddress].getState(blockNumber);
        if (!state) {
          state = await this.eventPools[poolAddress].generateState(blockNumber);
        }
        let [unit, prices] = this.getPricesPool(
          from.address,
          to.address,
          unitVolume,
          amounts,
          side,
          state,
          currentTimestamp,
        );

        if (unit === 0n) {
          // If we didn't fulfill unit amount, scale up the latest amount with a positive price till unit
          let i = prices.length - 1;
          let largestAmountPositivePrice = prices.slice(i)[0];
          while (largestAmountPositivePrice == 0n && i > 0) {
            --i;
            largestAmountPositivePrice = prices.slice(i)[0];
          }
          if (largestAmountPositivePrice > 0n) {
            unit =
              (unitVolume * largestAmountPositivePrice) / amounts.slice(i)[0];
          }
        }
        return {
          prices,
          unit,
          data: {
            pool: poolAddress,
          },
          poolAddresses: [poolAddress],
          exchange: this.dexKey,
          gasCost: MAX_GAS_COST_ESTIMATION,
          poolIdentifier: this.getPoolIdentifier(poolAddress),
        };
      }),
    );
  }
}
