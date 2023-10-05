import { DeepReadonly, assert } from 'ts-essentials';
import { Address, Log, Logger, Token } from '../../types';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  PoolState,
  SubgraphPoolBase,
  VerifiedPoolTypes,
  PoolStateMap,
  PoolPairData,
} from './types';
import _, { keyBy } from 'lodash';
import { SUBGRAPH_TIMEOUT, SwapSide } from '../../constants';
import {
  _getSecondaryTokenAmount,
  decodeOnChainCalls,
  getNewAmount,
  getOnChainCalls,
  getSwapMaxAmount,
  handlePoolBalanceChanged,
  handleSwap,
  isSupportedPool,
  parsePoolPairData,
  poolGetMainTokens,
  typecastReadOnlyPoolState,
} from './utils';
import {
  getPrimaryTokenIn,
  getPrimaryTokenOut,
} from './pools/primary/primaryPool';
import {
  getSecondaryTokenIn,
  getSecondaryTokenOut,
} from './pools/secondary/secondarPool';
import {
  MAX_POOL_CNT,
  POOL_CACHE_TTL,
  VAULT_INTERFACE,
  fetchAllPools,
} from './constants';

export class VerifiedEventPool extends StatefulEventSubscriber<PoolStateMap> {
  handlers: {
    [event: string]: (event: any, pool: PoolState, log: Log) => PoolState;
  } = {};

  logDecoder: (log: Log) => any;

  public addressesSubscribed: string[];
  eventSupportedPoolTypes: VerifiedPoolTypes[] = [
    VerifiedPoolTypes.PrimaryIssuePool,
    VerifiedPoolTypes.SecondaryIssuePool,
  ];
  public allPools: SubgraphPoolBase[] = [];

  constructor(
    readonly parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    public vaultAddress: Address,
    protected subgraphURL: string,
    logger: Logger,
  ) {
    super(parentName, vaultAddress, dexHelper, logger);
    this.logDecoder = (log: Log) => VAULT_INTERFACE.parseLog(log);
    this.addressesSubscribed = [vaultAddress];
    this.handlers['Swap'] = handleSwap.bind(this);
    this.handlers['PoolBalanceChanged'] = handlePoolBalanceChanged.bind(this);
  }

  //This function is called every time any of the subscribed addresses release log.
  //The function accepts the current state, updates the state according to the log,
  //and returns the updated state.
  protected processLog(
    state: DeepReadonly<PoolStateMap>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolStateMap> | null {
    const _state: PoolStateMap = {};
    for (const [address, pool] of Object.entries(state))
      _state[address] = typecastReadOnlyPoolState(pool);

    try {
      const event = this.logDecoder(log);
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

  //Fetchs pools that fit into the fetchAllPools Query from subgraph and save to memory
  //if memory pools cache exist in memory it uses that instead
  async fetchAllSubgraphPools(): Promise<SubgraphPoolBase[]> {
    //check memory for saved pools
    const cacheKey = 'VerifiedBalancerSubgraphPools2';
    const cachedPools = await this.dexHelper.cache.get(
      this.parentName,
      this.network,
      cacheKey,
    );
    //use pools from memory if they exist
    if (cachedPools) {
      const allPools = JSON.parse(cachedPools);
      this.logger.info(
        `Got ${allPools.length} ${this.parentName}_${this.network} pools from cache`,
      );
      return allPools;
    }
    //fetch pools from subgraph and filter if memory pools do exist
    this.logger.info(
      `Fetching ${this.parentName}_${this.network} Pools from subgraph`,
    );
    const poolsCount = {
      count: MAX_POOL_CNT,
    };
    const { data } = await this.dexHelper.httpRequest.post(
      this.subgraphURL,
      { query: fetchAllPools, poolsCount },
      SUBGRAPH_TIMEOUT,
    );

    if (!(data && data.pools))
      throw new Error('Unable to fetch pools from Verified-Balancer subgraph');
    const poolsMap = keyBy(data.pools, 'address');
    const allPools: SubgraphPoolBase[] = data.pools.map(
      (pool: Omit<SubgraphPoolBase, 'mainTokens'>) => ({
        ...pool,
        mainTokens: poolGetMainTokens(pool, poolsMap),
      }),
    );

    //save to memory
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

  //Makes onchain multicalls using precontructed data.
  //Decodes the results and returns saved pools in address to poolstate Mapping
  async getOnChainState(
    subgraphPoolBase: SubgraphPoolBase[],
    blockNumber: number,
  ): Promise<PoolStateMap> {
    const multiCallData = subgraphPoolBase
      .map(pool => {
        if (!isSupportedPool(pool.poolType)) return [];

        return getOnChainCalls(pool, this.vaultAddress);
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
        if (!isSupportedPool(pool.poolType)) return acc;
        const [decoded, newIndex] = decodeOnChainCalls(pool, returnData, i);
        i = newIndex;
        acc = { ...acc, ...decoded };
        return acc;
      },
      {},
    );
    return onChainStateMap;
  }

  //The function generates state using on-chain calls.
  //This function is called to regenerate state if the event based system fails to fetch events
  // and the local/memory state is no more correct.
  async generateState(blockNumber: number): Promise<Readonly<PoolStateMap>> {
    const allPools = await this.fetchAllSubgraphPools();
    this.allPools = allPools;
    const eventSupportedPools = allPools.filter(pool =>
      this.eventSupportedPoolTypes.includes(pool.poolType),
    );
    const allPoolsLatestState = await this.getOnChainState(
      eventSupportedPools,
      blockNumber,
    );
    return allPoolsLatestState;
  }

  // Helper function that get tokenIn when buying in both primary and secondaery issue pools
  onBuy(
    amounts: bigint[],
    poolPairData: PoolPairData,
    isCurrencyIn: boolean,
    creator: string | undefined,
    poolType: VerifiedPoolTypes,
  ): bigint[] | null {
    if (poolType === VerifiedPoolTypes.PrimaryIssuePool) {
      return amounts.map(amount =>
        getPrimaryTokenIn(poolPairData, amount, isCurrencyIn),
      );
    } else if (poolType === VerifiedPoolTypes.SecondaryIssuePool) {
      return amounts.map(amount =>
        getSecondaryTokenIn(poolPairData, amount, creator!, isCurrencyIn),
      );
    } else {
      this.logger.error(`OnBuy Error: Invalid Pool type: ${poolType}`);
      return null;
    }
  }

  //Helper function that get tokenOut when selling in both primary and secondaery issue pools
  onSell(
    amounts: bigint[],
    poolPairData: PoolPairData,
    isCurrencyIn: boolean,
    creator: string | undefined,
    poolType: VerifiedPoolTypes,
  ): bigint[] | null {
    if (poolType === VerifiedPoolTypes.PrimaryIssuePool) {
      return amounts.map(amount =>
        getPrimaryTokenOut(poolPairData, amount, isCurrencyIn),
      );
    } else if (poolType === VerifiedPoolTypes.SecondaryIssuePool) {
      return amounts.map(amount =>
        getSecondaryTokenOut(poolPairData, amount, creator!, isCurrencyIn),
      );
    } else {
      this.logger.error(`OnSell Error: Invalid Pool type: ${poolType}`);
      return null;
    }
  }

  //gets prices for from and to in a pool(primary or secondarypool) when buying or selling
  getPricesPool(
    from: Token,
    to: Token,
    subgraphPool: SubgraphPoolBase,
    poolState: PoolState,
    amounts: bigint[],
    unitVolume: bigint,
    side: SwapSide,
  ): { unit: bigint; prices: bigint[] } | null {
    if (!isSupportedPool(subgraphPool.poolType)) {
      this.logger.error(`Unsupported Pool Type: ${subgraphPool.poolType}`);
      return null;
    }
    const amountWithoutZero = amounts.slice(1);
    const poolPairData = parsePoolPairData(
      subgraphPool,
      poolState,
      from.address,
      to.address,
    );
    const swapMaxAmount = getSwapMaxAmount(poolPairData, side);
    const checkedAmounts: bigint[] = new Array(amountWithoutZero.length).fill(
      0n,
    );
    const checkedUnitVolume = getNewAmount(swapMaxAmount, unitVolume);
    let nonZeroAmountIndex = 0;
    for (const [i, amountIn] of amountWithoutZero.entries()) {
      const checkedOutput = getNewAmount(swapMaxAmount, amountIn);
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
    const isCurrencyIn = from.address === subgraphPool.currency;
    //Todo: Figure out creator
    let creator;
    const unitResult =
      checkedUnitVolume === 0n
        ? 0n
        : side === SwapSide.SELL
        ? this.onSell(
            [checkedUnitVolume],
            poolPairData,
            isCurrencyIn,
            creator,
            subgraphPool.poolType,
          )![0]
        : this.onBuy(
            [checkedUnitVolume],
            poolPairData,
            isCurrencyIn,
            creator,
            subgraphPool.poolType,
          )![0];
    const prices: bigint[] = new Array(amounts.length).fill(0n);
    const outputs =
      side === SwapSide.SELL
        ? this.onSell(
            amountWithoutZero.slice(0, nonZeroAmountIndex),
            poolPairData,
            isCurrencyIn,
            creator,
            subgraphPool.poolType,
          )
        : this.onBuy(
            amountWithoutZero.slice(0, nonZeroAmountIndex),
            poolPairData,
            isCurrencyIn,
            creator,
            subgraphPool.poolType,
          );

    assert(
      outputs && outputs.length <= prices.length,
      `Wrong length logic: outputs.length (${
        outputs!.length
      }) <= prices.length (${prices.length})`,
    );

    for (const [i, output] of outputs.entries()) {
      // Outputs shifted right to one to keep first entry as 0
      prices[i + 1] = output;
    }

    return { unit: unitResult, prices };
  }
}
