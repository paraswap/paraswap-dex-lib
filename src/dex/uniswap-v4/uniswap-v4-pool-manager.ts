import {
  InitializeStateOptions,
  StatefulEventSubscriber,
} from '../../stateful-event-subscriber';
import { DexParams, Pool, PoolManagerState, SubgraphPool } from './types';
import { Address, Log, Logger } from '../../types';
import UniswapV4StateViewABI from '../../abi/uniswap-v4/state-view.abi.json';
import UniswapV4PoolManagerABI from '../../abi/uniswap-v4/pool-manager.abi.json';
import { Interface } from 'ethers/lib/utils';
import { IDexHelper } from '../../dex-helper';
import { AsyncOrSync, DeepReadonly } from 'ts-essentials';
import { LogDescription } from '@ethersproject/abi/lib.esm';
import {
  queryAvailablePoolsForPairFromSubgraph,
  queryOnePageForAllAvailablePoolsFromSubgraph,
} from './subgraph';
import { isETHAddress } from '../../utils';
import { NULL_ADDRESS } from '../../constants';
import {
  POOL_CACHE_REFRESH_INTERVAL,
  POOLS_INITIALIZATION_LIMIT,
} from './constants';
import { FactoryState } from '../uniswap-v3/types';
import { UniswapV4Pool } from './uniswap-v4-pool';

export class UniswapV4PoolManager extends StatefulEventSubscriber<PoolManagerState> {
  handlers: {
    [event: string]: (event: any, log: Log) => AsyncOrSync<PoolManagerState>;
  } = {};

  private pools: SubgraphPool[] = [];

  eventPools: Record<string, UniswapV4Pool> = {};

  logDecoder: (log: Log) => any;

  stateViewIface: Interface;

  poolManagerIface: Interface;

  private subgraphPoolsCacheKey = 'subgraph_pools';

  constructor(
    readonly dexHelper: IDexHelper,
    parentName: string,
    private readonly network: number,
    private readonly config: DexParams,
    protected logger: Logger,
    mapKey: string = '',
  ) {
    super(
      parentName,
      `${parentName} PoolManager`,
      dexHelper,
      logger,
      true,
      mapKey,
    );

    this.stateViewIface = new Interface(UniswapV4StateViewABI);
    this.poolManagerIface = new Interface(UniswapV4PoolManagerABI);
    this.addressesSubscribed = [this.config.poolManager];

    this.logDecoder = (log: Log) => this.poolManagerIface.parseLog(log);

    // Add handlers
    this.handlers['Initialize'] = this.handleInitializeEvent.bind(this);
  }

  async initialize(
    blockNumber: number,
    options?: InitializeStateOptions<PoolManagerState>,
  ) {
    return super.initialize(blockNumber, options);
  }

  generateState(): FactoryState {
    return {};
  }

  protected async processLog(
    _: DeepReadonly<FactoryState>,
    log: Readonly<Log>,
  ): Promise<FactoryState> {
    const event = this.logDecoder(log);
    if (event.name in this.handlers) {
      await this.handlers[event.name](event, log);
    }

    return {};
  }

  public async getAvailablePoolsForPair(
    srcToken: Address,
    destToken: Address,
    blockNumber: number,
  ): Promise<Pool[]> {
    const isEthSrc = isETHAddress(srcToken);
    const isEthDest = isETHAddress(destToken);

    const _src = isEthSrc ? NULL_ADDRESS : srcToken.toLowerCase();
    const _dest = isEthDest ? NULL_ADDRESS : destToken.toLowerCase();

    let pools = this.pools.filter(
      pool =>
        (pool.token0.address === _src && pool.token1.address === _dest) ||
        (pool.token0.address === _dest && pool.token1.address === _src),
    );

    if (pools.length === 0) {
      const newPoolsToInit = await this.queryPoolsForPair(_src, _dest);

      await Promise.all(
        newPoolsToInit.map(async pool => {
          const eventPool = new UniswapV4Pool(
            this.dexHelper,
            this.parentName,
            this.network,
            this.config,
            this.logger,
            '',
            pool.id.toLowerCase(),
            pool.token0.address.toLowerCase(),
            pool.token1.address.toLowerCase(),
            pool.fee,
            pool.hooks,
            0n,
            pool.tick,
            pool.tickSpacing,
          );
          await eventPool.initialize(blockNumber);

          // Add new Pool
          this.pools.push(pool);
          this.eventPools[pool.id.toLowerCase()] = eventPool;
        }),
      );

      if (newPoolsToInit.length > 0) {
        pools = this.pools.filter(
          pool =>
            (pool.token0.address === _src && pool.token1.address === _dest) ||
            (pool.token0.address === _dest && pool.token1.address === _src),
        );
      }
    }

    return pools.map(pool => ({
      id: pool.id,
      key: {
        currency0: pool.token0.address,
        currency1: pool.token1.address,
        fee: pool.fee,
        tickSpacing: parseInt(pool.tickSpacing),
        hooks: pool.hooks,
      },
    }));
  }

  private async queryPoolsForPair(
    srcToken: Address,
    destToken: Address,
  ): Promise<SubgraphPool[]> {
    const cachedSubgraphPools = await this.dexHelper.cache.getAndCacheLocally(
      this.parentName,
      this.network,
      this.subgraphPoolsCacheKey,
      POOL_CACHE_REFRESH_INTERVAL,
    );

    let pools: SubgraphPool[];
    if (cachedSubgraphPools) {
      pools = JSON.parse(cachedSubgraphPools);
    } else {
      pools = [];
    }

    const poolsForPair = pools.filter(
      pool =>
        (pool.token0.address === srcToken &&
          pool.token1.address === destToken) ||
        (pool.token0.address === destToken && pool.token1.address === srcToken),
    );

    if (poolsForPair.length > 0) return poolsForPair;

    const newlyRequestedPoolsForPair =
      await queryAvailablePoolsForPairFromSubgraph(
        this.dexHelper,
        this.config.subgraphURL,
        srcToken,
        destToken,
      );

    newlyRequestedPoolsForPair.forEach(pool => pools.push(pool));
    await this.dexHelper.cache.setexAndCacheLocally(
      this.parentName,
      this.network,
      this.subgraphPoolsCacheKey,
      POOL_CACHE_REFRESH_INTERVAL,
      JSON.stringify(pools),
    );

    return pools;
  }

  async handleInitializeEvent(
    event: LogDescription,
    log: Log,
  ): Promise<PoolManagerState> {
    const id = event.args.id.toLowerCase();
    const currency0 = event.args.currency0;
    const currency1 = event.args.currency1;
    const fee = event.args.fee;
    const tickSpacing = parseInt(event.args.tickSpacing);
    const hooks = event.args.hooks;
    const sqrtPriceX96 = BigInt(event.args.sqrtPriceX96);
    const tick = parseInt(event.args.tick);

    this.pools.push({
      id,
      fee,
      hooks,
      token0: {
        address: currency0.toLowerCase(),
      },
      token1: {
        address: currency1.toLowerCase(),
      },
      tick: tick.toString(),
      tickSpacing: tickSpacing.toString(),
      ticks: [],
    });

    const eventPool = new UniswapV4Pool(
      this.dexHelper,
      this.parentName,
      this.network,
      this.config,
      this.logger,
      '',
      id,
      currency0.toLowerCase(),
      currency1.toLowerCase(),
      fee,
      hooks,
      sqrtPriceX96,
      tick.toString(),
      tickSpacing.toString(),
    );
    await eventPool.initialize(log.blockNumber);

    this.eventPools[id] = eventPool;

    return {};
  }
}
