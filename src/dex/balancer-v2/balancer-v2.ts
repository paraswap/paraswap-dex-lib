import { Interface } from '@ethersproject/abi';
import { assert, DeepReadonly } from 'ts-essentials';
import _, { keyBy } from 'lodash';
import {
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  Log,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
} from '../../types';
import {
  SwapSide,
  ETHER_ADDRESS,
  NULL_ADDRESS,
  MAX_INT,
  MAX_UINT,
  Network,
  SUBGRAPH_TIMEOUT,
} from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { StablePool, WeightedPool } from './balancer-v2-pool';
import { PhantomStablePool } from './PhantomStablePool';
import { LinearPool } from './LinearPool';
import VaultABI from '../../abi/balancer-v2/vault.json';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { getDexKeysWithNetwork, getBigIntPow } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper';
import {
  PoolState,
  SubgraphPoolBase,
  BalancerV2Data,
  BalancerParam,
  BalancerSwap,
  OptimizedBalancerV2Data,
  SwapTypes,
  PoolStateMap,
  PoolStateCache,
  BalancerPoolTypes,
  SubgraphPoolAddressDictionary,
} from './types';
import { SimpleExchange } from '../simple-exchange';
import { BalancerConfig, Adapters } from './config';
import {
  getAllPoolsUsedInPaths,
  isSameAddress,
  poolGetMainTokens,
  poolGetPathForTokenInOut,
} from './utils';
import { MIN_USD_LIQUIDITY_TO_FETCH } from './constants';

const fetchAllPools = `query ($count: Int) {
  pools: pools(
    first: $count
    orderBy: totalLiquidity
    orderDirection: desc
    where: {totalLiquidity_gt: ${MIN_USD_LIQUIDITY_TO_FETCH.toString()}, totalShares_not_in: ["0", "0.000000000001"], id_not_in: ["0xbd482ffb3e6e50dc1c437557c3bea2b68f3683ee0000000000000000000003c6"], swapEnabled: true, poolType_in: ["MetaStable", "Stable", "Weighted", "LiquidityBootstrapping", "Investment", "StablePhantom", "AaveLinear", "ERC4626Linear", "Linear", "ComposableStable"]}
  ) {
    id
    address
    poolType
    tokens {
      address
      decimals
    }
    mainIndex
    wrappedIndex
  }
}`;
// skipping low liquidity composableStablePool (0xbd482ffb3e6e50dc1c437557c3bea2b68f3683ee0000000000000000000003c6) with oracle issues. Experimental.

const fetchWeightUpdating = `query ($count: Int, $timestampPast: Int, $timestampFuture: Int) {
  gradualWeightUpdates(
    first: $count,
    where: {startTimestamp_lt: $timestampFuture, endTimestamp_gt: $timestampPast }
  ) {
    poolId {
      address
    }
  }
}`;

const MAX_POOL_CNT = 1000; // Taken from SOR
const POOL_CACHE_TTL = 60 * 60; // 1 hr
const POOL_EVENT_DISABLED_TTL = 5 * 60; // 5 min
const POOL_EVENT_REENABLE_DELAY = 7 * 24 * 60 * 60; // 1 week

function typecastReadOnlyPoolState(pool: DeepReadonly<PoolState>): PoolState {
  return _.cloneDeep(pool) as PoolState;
}

export class BalancerV2EventPool extends StatefulEventSubscriber<PoolStateMap> {
  public vaultInterface: Interface;

  handlers: {
    [event: string]: (event: any, pool: PoolState, log: Log) => PoolState;
  } = {};

  pools: {
    [type: string]: WeightedPool | StablePool | LinearPool | PhantomStablePool;
  };

  public allPools: SubgraphPoolBase[] = [];
  vaultDecoder: (log: Log) => any;

  eventSupportedPoolTypes: BalancerPoolTypes[] = [
    BalancerPoolTypes.Stable,
    BalancerPoolTypes.Weighted,
    BalancerPoolTypes.LiquidityBootstrapping,
    BalancerPoolTypes.Investment,

    // Need to check if we can support these pools with event base
    // BalancerPoolTypes.ComposableStable,
    // BalancerPoolTypes.Linear,
    // BalancerPoolTypes.MetaStable,
    // BalancerPoolTypes.AaveLinear,
    // BalancerPoolTypes.ERC4626Linear,

    // If this pool is enabled as event supported, it is failing BeetsFi: can not decode getRate()
    // BalancerPoolTypes.StablePhantom,
  ];

  eventRemovedPools = (
    [
      // Gradual weight changes are not currently handled in event system
      // This pool keeps changing weights and is causing pricing issue
      // But should now be handled by eventDisabledPools so don't need here!
      //'0x34809aEDF93066b49F638562c42A9751eDb36DF5',
    ] as Address[]
  ).map(s => s.toLowerCase());

  constructor(
    parentName: string,
    protected network: number,
    protected vaultAddress: Address,
    protected subgraphURL: string,
    protected dexHelper: IDexHelper,
    logger: Logger,
  ) {
    super(parentName, vaultAddress, dexHelper, logger);
    this.vaultInterface = new Interface(VaultABI);
    const weightedPool = new WeightedPool(
      this.vaultAddress,
      this.vaultInterface,
    );
    const stablePool = new StablePool(this.vaultAddress, this.vaultInterface);
    const stablePhantomPool = new PhantomStablePool(
      this.vaultAddress,
      this.vaultInterface,
    );
    /*
    ComposableStable has same maths as StablePhantom.
    The main difference is that ComposableStables have join/exit functions when StablePhantom did not.
    The difference of note for swaps is ComposableStable must use 'actualSupply' instead of VirtualSupply.
    VirtualSupply could be calculated easily whereas actualSupply cannot hence the use of onchain call.
    */
    const composableStable = new PhantomStablePool(
      this.vaultAddress,
      this.vaultInterface,
      true,
    );
    const linearPool = new LinearPool(this.vaultAddress, this.vaultInterface);

    this.pools = {};
    this.pools[BalancerPoolTypes.Weighted] = weightedPool;
    this.pools[BalancerPoolTypes.Stable] = stablePool;
    this.pools[BalancerPoolTypes.MetaStable] = stablePool;
    this.pools[BalancerPoolTypes.LiquidityBootstrapping] = weightedPool;
    this.pools[BalancerPoolTypes.Investment] = weightedPool;
    this.pools[BalancerPoolTypes.AaveLinear] = linearPool;
    // ERC4626Linear has the same maths and ABI as AaveLinear (has different factory)
    this.pools[BalancerPoolTypes.ERC4626Linear] = linearPool;
    // Beets uses "Linear" generically for all linear pool types
    this.pools[BalancerPoolTypes.Linear] = linearPool;
    this.pools[BalancerPoolTypes.StablePhantom] = stablePhantomPool;
    this.pools[BalancerPoolTypes.ComposableStable] = composableStable;
    this.vaultDecoder = (log: Log) => this.vaultInterface.parseLog(log);
    this.addressesSubscribed = [vaultAddress];

    // Add default handlers
    this.handlers['Swap'] = this.handleSwap.bind(this);
    this.handlers['PoolBalanceChanged'] =
      this.handlePoolBalanceChanged.bind(this);
  }

  protected processLog(
    state: DeepReadonly<PoolStateMap>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolStateMap> | null {
    const _state: PoolStateMap = {};
    for (const [address, pool] of Object.entries(state))
      _state[address] = typecastReadOnlyPoolState(pool);

    try {
      const event = this.vaultDecoder(log);
      if (event.name in this.handlers) {
        const poolAddress = event.args.poolId.slice(0, 42).toLowerCase();
        // Only update the _state if we are tracking the pool
        if (poolAddress in _state) {
          _state[poolAddress] = this.handlers[event.name](
            event,
            _state[poolAddress],
            log,
          );
        }
      }
      return _state;
    } catch (e) {
      this.logger.error(
        `Error_${this.parentName}_processLog could not parse the log with topic ${log.topics}:`,
        e,
      );
      return null;
    }
  }

  async fetchAllSubgraphPools(): Promise<SubgraphPoolBase[]> {
    const cacheKey = 'BalancerV2SubgraphPools';
    const cachedPools = await this.dexHelper.cache.get(
      this.parentName,
      this.network,
      cacheKey,
    );
    if (cachedPools) {
      const allPools = JSON.parse(cachedPools);
      this.logger.info(
        `Got ${allPools.length} ${this.parentName}_${this.network} pools from cache`,
      );
      return allPools;
    }

    this.logger.info(
      `Fetching ${this.parentName}_${this.network} Pools from subgraph`,
    );
    const variables = {
      count: MAX_POOL_CNT,
    };
    const { data } = await this.dexHelper.httpRequest.post(
      this.subgraphURL,
      { query: fetchAllPools, variables },
      SUBGRAPH_TIMEOUT,
    );

    if (!(data && data.pools))
      throw new Error('Unable to fetch pools from the subgraph');

    const poolsMap = keyBy(data.pools, 'address');
    const allPools: SubgraphPoolBase[] = data.pools.map(
      (pool: Omit<SubgraphPoolBase, 'mainTokens'>) => ({
        ...pool,
        mainTokens: poolGetMainTokens(pool, poolsMap),
      }),
    );

    this.dexHelper.cache.setex(
      this.parentName,
      this.network,
      cacheKey,
      POOL_CACHE_TTL,
      JSON.stringify(allPools),
    );

    this.logger.info(
      `Got ${allPools.length} ${this.parentName}_${this.network} pools from subgraph`,
    );
    return allPools;
  }

  async generateState(blockNumber: number): Promise<Readonly<PoolStateMap>> {
    const allPools = await this.fetchAllSubgraphPools();
    this.allPools = allPools;
    const eventSupportedPools = allPools.filter(
      pool =>
        this.eventSupportedPoolTypes.includes(pool.poolType) &&
        !this.eventRemovedPools.includes(pool.address.toLowerCase()),
    );
    const allPoolsLatestState = await this.getOnChainState(
      eventSupportedPools,
      blockNumber,
    );
    return allPoolsLatestState;
  }

  handleSwap(event: any, pool: PoolState, log: Log): PoolState {
    const tokenIn = event.args.tokenIn.toLowerCase();
    const amountIn = BigInt(event.args.amountIn.toString());
    const tokenOut = event.args.tokenOut.toLowerCase();
    const amountOut = BigInt(event.args.amountOut.toString());
    pool.tokens[tokenIn].balance += amountIn;
    pool.tokens[tokenOut].balance -= amountOut;
    return pool;
  }

  handlePoolBalanceChanged(event: any, pool: PoolState, log: Log): PoolState {
    const tokens = event.args.tokens.map((t: string) => t.toLowerCase());
    const deltas = event.args.deltas.map((d: any) => BigInt(d.toString()));
    const fees = event.args.protocolFeeAmounts.map((d: any) =>
      BigInt(d.toString()),
    ) as bigint[];
    tokens.forEach((t: string, i: number) => {
      const diff = deltas[i] - fees[i];
      pool.tokens[t].balance += diff;
    });
    return pool;
  }

  isSupportedPool(poolType: string): boolean {
    const supportedPoolTypes: string[] = Object.values(BalancerPoolTypes);
    return supportedPoolTypes.includes(poolType);
  }

  getPricesPool(
    from: Token,
    to: Token,
    subgraphPool: SubgraphPoolBase,
    poolState: PoolState,
    amounts: bigint[],
    unitVolume: bigint,
    side: SwapSide,
  ): { unit: bigint; prices: bigint[] } | null {
    if (!this.isSupportedPool(subgraphPool.poolType)) {
      this.logger.error(`Unsupported Pool Type: ${subgraphPool.poolType}`);
      return null;
    }

    const amountWithoutZero = amounts.slice(1);
    const pool = this.pools[subgraphPool.poolType];

    const poolPairData = pool.parsePoolPairData(
      subgraphPool,
      poolState,
      from.address,
      to.address,
    );

    const swapMaxAmount = pool.getSwapMaxAmount(
      // Don't like this but don't have time to refactor it properly
      poolPairData as any,
      side,
    );

    const checkedAmounts: bigint[] = new Array(amountWithoutZero.length).fill(
      0n,
    );
    const checkedUnitVolume = pool._nullifyIfMaxAmountExceeded(
      unitVolume,
      swapMaxAmount,
    );

    let nonZeroAmountIndex = 0;
    for (const [i, amountIn] of amountWithoutZero.entries()) {
      const checkedOutput = pool._nullifyIfMaxAmountExceeded(
        amountIn,
        swapMaxAmount,
      );
      if (checkedOutput === 0n) {
        // Stop earlier because other values are bigger and for sure wont' be tradable
        break;
      }
      nonZeroAmountIndex = i + 1;
      checkedAmounts[i] = checkedOutput;
    }

    if (nonZeroAmountIndex === 0) {
      return null;
    }

    const unitResult =
      checkedUnitVolume === 0n
        ? 0n
        : pool.onSell([checkedUnitVolume], poolPairData as any)[0];

    const prices: bigint[] = new Array(amounts.length).fill(0n);
    const outputs = pool.onSell(
      amountWithoutZero.slice(0, nonZeroAmountIndex),
      poolPairData as any,
    );

    assert(
      outputs.length <= prices.length,
      `Wrong length logic: outputs.length (${outputs.length}) <= prices.length (${prices.length})`,
    );

    for (const [i, output] of outputs.entries()) {
      // Outputs shifted right to one to keep first entry as 0
      prices[i + 1] = output;
    }

    return { unit: unitResult, prices };
  }

  async getOnChainState(
    subgraphPoolBase: SubgraphPoolBase[],
    blockNumber: number,
  ): Promise<PoolStateMap> {
    const multiCallData = subgraphPoolBase
      .map(pool => {
        if (!this.isSupportedPool(pool.poolType)) return [];

        return this.pools[pool.poolType].getOnChainCalls(pool);
      })
      .flat();

    // 500 is an arbitrary number chosen based on the blockGasLimit
    const slicedMultiCallData = _.chunk(multiCallData, 500);

    const returnData = (
      await Promise.all(
        slicedMultiCallData.map(async _multiCallData =>
          this.dexHelper.multiContract.methods
            .tryAggregate(false, _multiCallData)
            .call({}, blockNumber),
        ),
      )
    ).flat();

    let i = 0;
    const onChainStateMap = subgraphPoolBase.reduce(
      (acc: { [address: string]: PoolState }, pool) => {
        if (!this.isSupportedPool(pool.poolType)) return acc;

        const [decoded, newIndex] = this.pools[
          pool.poolType
        ].decodeOnChainCalls(pool, returnData, i);
        i = newIndex;
        acc = { ...acc, ...decoded };
        return acc;
      },
      {},
    );

    return onChainStateMap;
  }
}

export class BalancerV2
  extends SimpleExchange
  implements IDex<BalancerV2Data, BalancerParam, OptimizedBalancerV2Data>
{
  protected eventPools: BalancerV2EventPool;

  readonly hasConstantPriceLargeAmounts = false;
  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(BalancerConfig);

  logger: Logger;

  // In memory pool state for non-event pools
  nonEventPoolStateCache: PoolStateCache;

  eventDisabledPoolsTimer?: NodeJS.Timer;
  eventDisabledPools: Address[] = [];

  constructor(
    protected network: Network,
    dexKey: string,
    protected dexHelper: IDexHelper,
    protected vaultAddress: Address = BalancerConfig[dexKey][network]
      .vaultAddress,
    protected subgraphURL: string = BalancerConfig[dexKey][network].subgraphURL,
    protected adapters = Adapters[network],
  ) {
    super(dexHelper, dexKey);
    // Initialise cache - this will hold pool state of non-event pools in memory to be reused if block hasn't expired
    this.nonEventPoolStateCache = { blockNumber: 0, poolState: {} };
    this.logger = dexHelper.getLogger(dexKey);
    this.eventPools = new BalancerV2EventPool(
      dexKey,
      network,
      vaultAddress,
      subgraphURL,
      dexHelper,
      this.logger,
    );
  }

  async setupEventPools(blockNumber: number) {
    await this.eventPools.initialize(blockNumber);
  }

  async fetchEventDisabledPools() {
    const cacheKey = 'eventDisabledPools';
    const poolAddressListFromCache = await this.dexHelper.cache.get(
      this.dexKey,
      this.network,
      cacheKey,
    );
    if (poolAddressListFromCache) {
      this.eventDisabledPools = JSON.parse(poolAddressListFromCache);
      return;
    }
    this.logger.info(
      `Fetching ${this.dexKey}_${this.network} Weight Updates from subgraph`,
    );
    const timeNow = Math.floor(Date.now() / 1000);
    const variables = {
      count: MAX_POOL_CNT,
      timestampPast: timeNow - POOL_EVENT_REENABLE_DELAY,
      timestampFuture: timeNow + POOL_EVENT_DISABLED_TTL,
    };
    const { data } = await this.dexHelper.httpRequest.post(
      this.subgraphURL,
      { query: fetchWeightUpdating, variables },
      SUBGRAPH_TIMEOUT,
    );

    if (!(data && data.gradualWeightUpdates)) {
      throw new Error(
        `${this.dexKey}_${this.network} failed to fetch weight updates from subgraph`,
      );
    }

    this.eventDisabledPools = _.uniq(
      data.gradualWeightUpdates.map(
        (wu: { poolId: { address: Address } }) => wu.poolId.address,
      ),
    );
    const poolAddressList = JSON.stringify(this.eventDisabledPools);
    this.logger.info(
      `Pools blocked from event based on ${this.dexKey}_${this.network}: ${poolAddressList}`,
    );
    this.dexHelper.cache.setex(
      this.dexKey,
      this.network,
      cacheKey,
      POOL_EVENT_DISABLED_TTL,
      poolAddressList,
    );
  }

  async initializePricing(blockNumber: number) {
    if (!this.eventDisabledPoolsTimer) {
      await this.fetchEventDisabledPools();
      this.eventDisabledPoolsTimer = setInterval(async () => {
        try {
          await this.fetchEventDisabledPools();
        } catch (e) {
          this.logger.error(
            `${this.dexKey}: Failed to update event disabled pools:`,
            e,
          );
        }
      }, POOL_EVENT_DISABLED_TTL * 1000);
    }
    await this.setupEventPools(blockNumber);
  }

  releaseResources(): void {
    if (this.eventDisabledPoolsTimer) {
      clearInterval(this.eventDisabledPoolsTimer);
      this.eventDisabledPoolsTimer = undefined;
      this.logger.info(
        `${this.dexKey}: cleared eventDisabledPoolsTimer before shutting down`,
      );
    }
  }

  getPoolsWithTokenPair(from: Token, to: Token): SubgraphPoolBase[] {
    return this.eventPools.allPools
      .filter(p => {
        const fromMain = p.mainTokens.find(
          token => token.address.toLowerCase() === from.address.toLowerCase(),
        );
        const toMain = p.mainTokens.find(
          token => token.address.toLowerCase() === to.address.toLowerCase(),
        );

        return (
          fromMain &&
          toMain &&
          // filter instances similar to the following:
          // USDC -> DAI in a pool where bbaUSD is nested (ie: MAI / bbaUSD)
          !(fromMain.isDeeplyNested && toMain.isDeeplyNested)
        );
      })
      .slice(0, 10);
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    if (side === SwapSide.BUY) return null;
    return this.adapters;
  }

  async getPoolIdentifiers(
    from: Token,
    to: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    if (side === SwapSide.BUY) return [];
    const _from = this.dexHelper.config.wrapETH(from);
    const _to = this.dexHelper.config.wrapETH(to);

    const pools = this.getPoolsWithTokenPair(_from, _to);

    return pools.map(
      ({ address }) => `${this.dexKey}_${address.toLowerCase()}`,
    );
  }

  /**
   * Returns cached poolState if blockNumber matches cached value. Resets if not.
   */
  private getNonEventPoolStateCache(blockNumber: number): PoolStateMap {
    if (this.nonEventPoolStateCache.blockNumber !== blockNumber)
      this.nonEventPoolStateCache.poolState = {};
    return this.nonEventPoolStateCache.poolState;
  }

  /**
   * Update poolState cache.
   * If same blockNumber as current cache then update with new pool state.
   * If different blockNumber overwrite cache with latest.
   */
  private updateNonEventPoolStateCache(
    poolState: PoolStateMap,
    blockNumber: number,
  ): PoolStateMap {
    if (this.nonEventPoolStateCache.blockNumber !== blockNumber) {
      this.nonEventPoolStateCache.blockNumber = blockNumber;
      this.nonEventPoolStateCache.poolState = poolState;
    } else
      this.nonEventPoolStateCache.poolState = {
        ...this.nonEventPoolStateCache.poolState,
        ...poolState,
      };
    return this.nonEventPoolStateCache.poolState;
  }

  async getPricesVolume(
    from: Token,
    to: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<BalancerV2Data>> {
    if (side === SwapSide.BUY) return null;
    try {
      const _from = this.dexHelper.config.wrapETH(from);
      const _to = this.dexHelper.config.wrapETH(to);

      if (_from.address === _to.address) {
        return null;
      }

      const allPools = this.getPoolsWithTokenPair(_from, _to);
      const allowedPools = limitPools
        ? allPools.filter(({ address }) =>
            limitPools.includes(`${this.dexKey}_${address.toLowerCase()}`),
          )
        : allPools;

      if (!allowedPools.length) return null;

      const eventPoolStatesRO = await this.eventPools.getState(blockNumber);
      if (!eventPoolStatesRO) {
        this.logger.error(`getState returned null`);
      }
      const eventPoolStates = { ...(eventPoolStatesRO || {}) };
      for (const addr of this.eventDisabledPools) delete eventPoolStates[addr];

      // Fetch previously cached non-event pool states
      let nonEventPoolStates = this.getNonEventPoolStateCache(blockNumber);

      //get all pools that would be used in the paths, nested pools included
      const poolsFlattened = getAllPoolsUsedInPaths(
        _from.address,
        _to.address,
        allowedPools,
        this.poolAddressMap,
      );

      // Missing pools are pools that don't already exist in event or non-event
      const missingPools = poolsFlattened.filter(
        pool =>
          !(
            pool.address.toLowerCase() in eventPoolStates ||
            pool.address.toLowerCase() in nonEventPoolStates
          ),
      );

      // Retrieve onchain state for any missing pools
      if (missingPools.length > 0) {
        const missingPoolsStateMap = await this.eventPools.getOnChainState(
          missingPools,
          blockNumber,
        );
        // Update non-event pool state cache with newly retrieved data so it can be reused in future
        nonEventPoolStates = this.updateNonEventPoolStateCache(
          missingPoolsStateMap,
          blockNumber,
        );
      }

      const poolPrices = allowedPools
        .map((pool: SubgraphPoolBase) => {
          const poolAddress = pool.address.toLowerCase();

          const path = poolGetPathForTokenInOut(
            _from.address,
            _to.address,
            pool,
            this.poolAddressMap,
          );

          let pathAmounts = amounts;
          let resOut: { unit: bigint; prices: bigint[] } | null = null;

          for (let i = 0; i < path.length; i++) {
            const poolAddress = path[i].pool.address.toLowerCase();
            const poolState =
              eventPoolStates[poolAddress] || nonEventPoolStates[poolAddress];
            if (!poolState) {
              this.logger.error(`Unable to find the poolState ${poolAddress}`);
              return null;
            }

            const unitVolume = getBigIntPow(
              (side === SwapSide.SELL ? path[i].tokenIn : path[i].tokenOut)
                .decimals,
            );

            const res = this.eventPools.getPricesPool(
              path[i].tokenIn,
              path[i].tokenOut,
              path[i].pool,
              poolState,
              pathAmounts,
              unitVolume,
              side,
            );

            if (!res) {
              return null;
            }

            pathAmounts = res.prices;

            if (i === path.length - 1) {
              resOut = res;
            }
          }

          if (!resOut) {
            return null;
          }

          return {
            unit: resOut.unit,
            prices: resOut.prices,
            data: {
              poolId: pool.id,
            },
            poolAddresses: [poolAddress],
            exchange: this.dexKey,
            gasCost: 150 * 1000 * (path.length - 1),
            poolIdentifier: `${this.dexKey}_${poolAddress}`,
          };

          // TODO: re-check what should be the current block time stamp
        })
        .filter(p => !!p);
      return poolPrices as ExchangePrices<BalancerV2Data>;
    } catch (e) {
      this.logger.error(
        `Error_getPrices ${from.symbol || from.address}, ${
          to.symbol || to.address
        }, ${side}:`,
        e,
      );
      return null;
    }
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(
    poolPrices: PoolPrices<BalancerV2Data>,
  ): number | number[] {
    return (
      CALLDATA_GAS_COST.DEX_OVERHEAD +
      CALLDATA_GAS_COST.LENGTH_LARGE +
      // ParentStruct header
      CALLDATA_GAS_COST.OFFSET_SMALL +
      // ParentStruct -> swaps[] header
      CALLDATA_GAS_COST.OFFSET_LARGE +
      // ParentStruct -> assets[] header
      CALLDATA_GAS_COST.OFFSET_LARGE +
      // ParentStruct -> funds
      CALLDATA_GAS_COST.ADDRESS +
      CALLDATA_GAS_COST.BOOL +
      CALLDATA_GAS_COST.ADDRESS +
      CALLDATA_GAS_COST.BOOL +
      // ParentStruct -> limits[] header
      CALLDATA_GAS_COST.OFFSET_LARGE +
      // ParentStruct -> deadline
      CALLDATA_GAS_COST.TIMESTAMP +
      // ParentStruct -> swaps[]
      CALLDATA_GAS_COST.LENGTH_SMALL +
      // ParentStruct -> swaps[0] header
      CALLDATA_GAS_COST.OFFSET_SMALL +
      // ParentStruct -> swaps[0] -> poolId
      CALLDATA_GAS_COST.FULL_WORD +
      // ParentStruct -> swaps[0] -> assetInIndex
      CALLDATA_GAS_COST.INDEX +
      // ParentStruct -> swaps[0] -> assetOutIndex
      CALLDATA_GAS_COST.INDEX +
      // ParentStruct -> swaps[0] -> amount
      CALLDATA_GAS_COST.AMOUNT +
      // ParentStruct -> swaps[0] -> userData header
      CALLDATA_GAS_COST.OFFSET_SMALL +
      // ParentStruct -> swaps[0] -> userData
      CALLDATA_GAS_COST.ZERO +
      // ParentStruct -> assets[]
      CALLDATA_GAS_COST.LENGTH_SMALL +
      // ParentStruct -> assets[0:2]
      CALLDATA_GAS_COST.ADDRESS * 2 +
      // ParentStruct -> limits[]
      CALLDATA_GAS_COST.LENGTH_SMALL +
      // ParentStruct -> limits[0:2]
      CALLDATA_GAS_COST.FULL_WORD * 2
    );
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: OptimizedBalancerV2Data,
    side: SwapSide,
  ): AdapterExchangeParam {
    const params = this.getBalancerParam(
      srcToken,
      destToken,
      srcAmount,
      destAmount,
      data,
      side,
    );

    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          'swaps[]': {
            poolId: 'bytes32',
            assetInIndex: 'uint256',
            assetOutIndex: 'uint256',
            amount: 'uint256',
            userData: 'bytes',
          },
          assets: 'address[]',
          funds: {
            sender: 'address',
            fromInternalBalance: 'bool',
            recipient: 'address',
            toInternalBalance: 'bool',
          },
          limits: 'int256[]',
          deadline: 'uint256',
        },
      },
      {
        swaps: params[1],
        assets: params[2],
        funds: params[3],
        limits: params[4],
        deadline: params[5],
      },
    );

    return {
      targetExchange: this.vaultAddress,
      payload,
      networkFee: '0',
    };
  }

  private getBalancerParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: OptimizedBalancerV2Data,
    side: SwapSide,
  ): BalancerParam {
    let swapOffset = 0;
    let swaps: BalancerSwap[] = [];
    let assets: string[] = [];
    let limits: string[] = [];

    for (const swapData of data.swaps) {
      const pool = this.poolIdMap[swapData.poolId];
      const hasEth = [srcToken.toLowerCase(), destToken.toLowerCase()].includes(
        ETHER_ADDRESS.toLowerCase(),
      );
      const _srcToken = this.dexHelper.config.wrapETH({
        address: srcToken,
        decimals: 18,
      }).address;
      const _destToken = this.dexHelper.config.wrapETH({
        address: destToken,
        decimals: 18,
      }).address;

      const path = poolGetPathForTokenInOut(
        _srcToken,
        _destToken,
        pool,
        this.poolAddressMap,
      );

      const _swaps = path.map((hop, index) => ({
        poolId: hop.pool.id,
        assetInIndex: swapOffset + index,
        assetOutIndex: swapOffset + index + 1,
        amount: index === 0 ? swapData.amount : '0',
        userData: '0x',
      }));

      swapOffset += path.length + 1;

      // BalancerV2 Uses Address(0) as ETH
      const _assets = [_srcToken, ...path.map(hop => hop.tokenOut.address)].map(
        t => (hasEth && this.dexHelper.config.isWETH(t) ? NULL_ADDRESS : t),
      );

      const _limits = _assets.map(_ => MAX_INT);

      swaps = swaps.concat(_swaps);
      assets = assets.concat(_assets);
      limits = limits.concat(_limits);
    }

    const funds = {
      sender: this.augustusAddress,
      recipient: this.augustusAddress,
      fromInternalBalance: false,
      toInternalBalance: false,
    };

    const params: BalancerParam = [
      side === SwapSide.SELL ? SwapTypes.SwapExactIn : SwapTypes.SwapExactOut,
      swaps,
      assets,
      funds,
      limits,
      MAX_UINT,
    ];

    return params;
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: OptimizedBalancerV2Data,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const params = this.getBalancerParam(
      srcToken,
      destToken,
      srcAmount,
      destAmount,
      data,
      side,
    );

    const swapData = this.eventPools.vaultInterface.encodeFunctionData(
      'batchSwap',
      params,
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      this.vaultAddress,
    );
  }

  async updatePoolState(): Promise<void> {
    this.eventPools.allPools = await this.eventPools.fetchAllSubgraphPools();
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    count: number,
  ): Promise<PoolLiquidity[]> {
    const poolsWithToken = this.eventPools.allPools.filter(pool =>
      pool.mainTokens.some(mainToken =>
        isSameAddress(mainToken.address, tokenAddress),
      ),
    );

    const variables = {
      poolIds: poolsWithToken.map(pool => pool.id),
      count,
    };

    const query = `query ($poolIds: [String!]!, $count: Int) {
      pools (first: $count, orderBy: totalLiquidity, orderDirection: desc,
           where: {id_in: $poolIds,
                   swapEnabled: true,
                   totalLiquidity_gt: ${MIN_USD_LIQUIDITY_TO_FETCH.toString()}}) {
        address
        totalLiquidity
        tokens {
          address
          decimals
        }
      }
    }`;
    const { data } = await this.dexHelper.httpRequest.post<{
      data: {
        pools: {
          address: string;
          totalLiquidity: string;
          tokens: { address: string; decimals: number }[];
        }[];
      };
    }>(
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

    return _.map(data.pools, pool => {
      const subgraphPool = poolsWithToken.find(poolWithToken =>
        isSameAddress(poolWithToken.address, pool.address),
      )!;

      return {
        exchange: this.dexKey,
        address: pool.address.toLowerCase(),
        connectorTokens: subgraphPool.mainTokens.filter(
          token => !isSameAddress(tokenAddress, token.address),
        ),
        liquidityUSD: parseFloat(pool.totalLiquidity),
      };
    });
  }

  private get poolAddressMap(): SubgraphPoolAddressDictionary {
    return keyBy(this.eventPools.allPools, 'address');
  }

  private get poolIdMap(): { [poolId: string]: SubgraphPoolBase } {
    return keyBy(this.eventPools.allPools, 'id');
  }
}
