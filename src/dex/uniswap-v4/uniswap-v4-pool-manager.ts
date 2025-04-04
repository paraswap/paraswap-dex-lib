import {
  InitializeStateOptions,
  StatefulEventSubscriber,
} from '../../stateful-event-subscriber';
import { Pool, PoolManagerState, PoolState, SubgraphPool } from './types';
import { Address, Log, Logger } from '../../types';
import { BlockHeader } from 'web3-eth';
import UniswapV4StateViewABI from '../../abi/uniswap-v4/state-view.abi.json';
import UniswapV4PoolManagerABI from '../../abi/uniswap-v4/pool-manager.abi.json';
import { Interface } from 'ethers/lib/utils';
import { IDexHelper } from '../../dex-helper';
import { AsyncOrSync, DeepReadonly } from 'ts-essentials';
import { LogDescription } from '@ethersproject/abi/lib.esm';
import {
  queryOnePageForAllAvailablePoolsFromSubgraph,
  querySinglePoolFromSubgraphById,
} from './subgraph';
import { isETHAddress } from '../../utils';
import { NULL_ADDRESS } from '../../constants';
import { POOL_CACHE_REFRESH_INTERVAL } from './constants';
import { logger } from 'ethers';
import { sortPools } from './utils';

export class UniswapV4PoolManager extends StatefulEventSubscriber<PoolManagerState> {
  handlers: {
    [event: string]: (
      event: any,
      pool: PoolManagerState,
      log: Log,
      blockHeader: Readonly<BlockHeader>,
    ) => AsyncOrSync<PoolManagerState>;
  } = {};

  logDecoder: (log: Log) => any;

  stateViewIface: Interface;

  poolManagerIface: Interface;

  private poolsCacheKey = 'pools_states';

  constructor(
    readonly dexHelper: IDexHelper,
    parentName: string,
    private readonly network: number,
    private readonly poolManagerAddress: string,
    private readonly stateViewAddress: string,
    private readonly subgraphUrl: string,
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
    this.addressesSubscribed = [poolManagerAddress];

    this.logDecoder = (log: Log) => this.poolManagerIface.parseLog(log);

    // Add handlers
    this.handlers['Initialize'] = this.handleInitializeEvent.bind(this);
  }

  async initialize(
    blockNumber: number,
    options?: InitializeStateOptions<PoolManagerState>,
  ) {
    await super.initialize(blockNumber, options);
  }

  protected async processLog(
    state: PoolManagerState,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): Promise<DeepReadonly<PoolManagerState>> {
    const event = this.logDecoder(log);
    if (event.name in this.handlers) {
      await this.handlers[event.name](event, state, log, blockHeader);
    }

    return state;
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

    const state = this.getState(blockNumber);

    if (!state) {
      logger.info(
        `${this.name} PoolManager: state was not found blocknumber: ${blockNumber}`,
      );
      return [];
    }

    const poolStates = state._pools.filter(
      pool =>
        (pool.token0 === src && pool.token1 === dest) ||
        (pool.token0 === dest && pool.token1 === src),
    );

    return poolStates.map(state => ({
      id: state.id,
      key: {
        currency0: state.token0,
        currency1: state.token1,
        fee: state.fee,
        tickSpacing: state.tickSpacing,
        hooks: state.hooks,
      },
    }));
  }

  private async queryAllAvailablePools(
    blockNumber: number,
  ): Promise<PoolState[]> {
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
    let currentPools: SubgraphPool[] =
      await queryOnePageForAllAvailablePoolsFromSubgraph(
        this.dexHelper,
        this.logger,
        this.parentName,
        this.subgraphUrl,
        blockNumber,
        curPage * limit,
        limit,
      );
    pools = pools.concat(currentPools);

    while (currentPools.length === limit) {
      curPage++;
      currentPools = await queryOnePageForAllAvailablePoolsFromSubgraph(
        this.dexHelper,
        this.logger,
        this.parentName,
        this.subgraphUrl,
        blockNumber,
        curPage * limit,
        limit,
      );

      pools = pools.concat(currentPools);
    }

    const results = pools
      .map(pool => ({
        id: pool.id,
        token0: pool.token0.address,
        token1: pool.token1.address,
        fee: pool.fee,
        tickSpacing: pool.tickSpacing,
        hooks: pool.hooks,
        // tick: parseInt(pool.tick),
        // ticks: pool.ticks,
      }))
      .sort(sortPools);

    this.dexHelper.cache.setexAndCacheLocally(
      this.parentName,
      this.network,
      this.poolsCacheKey,
      POOL_CACHE_REFRESH_INTERVAL,
      JSON.stringify(results),
    );

    return results;
  }

  async generateState(blockNumber: number): Promise<PoolManagerState> {
    const pools = await this.queryAllAvailablePools(blockNumber);

    return {
      _pools: pools,
    };
  }

  async handleInitializeEvent(
    event: LogDescription,
    state: PoolManagerState,
    log: Log,
  ): Promise<PoolManagerState> {
    const id = event.args.id.toLowerCase();

    const subgraphPool = await querySinglePoolFromSubgraphById(
      this.dexHelper,
      this.subgraphUrl,
      log.blockNumber,
      id,
    );

    if (subgraphPool) {
      const newPool = {
        id: subgraphPool.id,
        token0: subgraphPool.token0.address,
        token1: subgraphPool.token1.address,
        fee: subgraphPool.fee,
        tickSpacing: subgraphPool.tickSpacing,
        hooks: subgraphPool.hooks,
        // tick: parseInt(subgraphPool.tick),
        // ticks: subgraphPool.ticks,
      } as PoolState;

      const pools = state._pools;
      pools.push(newPool);

      state = {
        ...state,
        _pools: pools.sort(sortPools),
      };
    }

    return state;
  }
}
