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
import { queryOnePageForAllAvailablePoolsFromSubgraph } from './subgraph';
import { isETHAddress } from '../../utils';
import { NULL_ADDRESS } from '../../constants';
import { POOL_CACHE_REFRESH_INTERVAL } from './constants';
import { FactoryState } from '../uniswap-v3/types';
import { UniswapV4Pool } from './uniswap-v4-pool';

export class UniswapV4PoolManager extends StatefulEventSubscriber<PoolManagerState> {
  handlers: {
    [event: string]: (event: any, log: Log) => AsyncOrSync<PoolManagerState>;
  } = {};

  pools: SubgraphPool[] = [];

  eventPools: Record<string, UniswapV4Pool> = {};

  logDecoder: (log: Log) => any;

  stateViewIface: Interface;

  poolManagerIface: Interface;

  private poolsCacheKey = 'pools_states';

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
    this.pools = await this.queryAllAvailablePools(blockNumber);

    this.eventPools = await this.pools.reduce<
      Promise<Record<string, UniswapV4Pool>>
    >(async (accum, pool) => {
      const accumP = await accum;
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

      accumP[pool.id] = eventPool;

      return accumP;
    }, Promise.resolve({} as Record<string, UniswapV4Pool>));

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

  public getAvailablePoolsForPair(
    srcToken: Address,
    destToken: Address,
    blockNumber: number,
  ): Pool[] {
    const isEthSrc = isETHAddress(srcToken);
    const isEthDest = isETHAddress(destToken);

    const src = isEthSrc ? NULL_ADDRESS : srcToken.toLowerCase();
    const dest = isEthDest ? NULL_ADDRESS : destToken.toLowerCase();

    const pools = this.pools.filter(
      pool =>
        (pool.token0.address === src && pool.token1.address === dest) ||
        (pool.token0.address === dest && pool.token1.address === src),
    );

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

  private async queryAllAvailablePools(
    blockNumber: number,
  ): Promise<SubgraphPool[]> {
    const cachedPools = await this.dexHelper.cache.getAndCacheLocally(
      this.parentName,
      this.network,
      this.poolsCacheKey,
      POOL_CACHE_REFRESH_INTERVAL,
    );

    if (cachedPools) {
      const pools = JSON.parse(cachedPools);
      return pools;
    }

    let pools: SubgraphPool[] = [];
    let curPage = 0;
    const limit = 1000;
    let currentSubgraphPools: SubgraphPool[] =
      await queryOnePageForAllAvailablePoolsFromSubgraph(
        this.dexHelper,
        this.logger,
        this.parentName,
        this.config.subgraphURL,
        blockNumber,
        curPage * limit,
        limit,
      );
    pools = pools.concat(currentSubgraphPools);

    while (currentSubgraphPools.length === limit) {
      curPage++;
      currentSubgraphPools = await queryOnePageForAllAvailablePoolsFromSubgraph(
        this.dexHelper,
        this.logger,
        this.parentName,
        this.config.subgraphURL,
        blockNumber,
        curPage * limit,
        limit,
      );

      pools = pools.concat(currentSubgraphPools);
    }

    this.dexHelper.cache.setexAndCacheLocally(
      this.parentName,
      this.network,
      this.poolsCacheKey,
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
