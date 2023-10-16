import { DeepReadonly, assert } from 'ts-essentials';
import { Interface } from '@ethersproject/abi';
import { Address, Log, Logger, Token } from '../../types';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  PoolState,
  SubgraphPoolBase,
  VerifiedPoolTypes,
  PoolStateMap,
} from './types';
import _, { keyBy } from 'lodash';
import { SUBGRAPH_TIMEOUT, SwapSide } from '../../constants';
import {
  getNewAmount,
  isSupportedPool,
  poolGetMainTokens,
  typecastReadOnlyPoolState,
} from './utils';
import { MAX_POOL_CNT, POOL_CACHE_TTL } from './constants';
import VAULTABI from '../../abi/verified/vault.json';
import { PrimaryIssuePool } from './pools/primary/primaryPool';
import { SecondaryIssuePool } from './pools/secondary/secondarPool';

//TODO: verify why polygon pools have no liquidity and update the query
//it must filter with liquidity
const fetchAllPools = `query ($count: Int)    {
  pools: pools(
    first: $count
    orderDirection: desc
    where: {
    swapEnabled: true, 
    poolType_in: ["PrimaryIssue", "SecondaryIssue"]
    }
  ) {
    id
    address
    poolType
    tokens {
      address
      decimals
    }
    security
    currency
    orders {
      id
      creator
      tokenIn {
       id
      }
      tokenOut {
       id
      }
      amountOffered
      priceOffered
      timestamp
      orderReference 
    }
    secondaryTrades{
      id
      party {
        id
      }
      counterparty {
        id
      }
      orderType
      price
      currency {
        id
      }
      amount
      executionDate
      orderReference
    }
  }
}`;

export class VerifiedEventPool extends StatefulEventSubscriber<PoolStateMap> {
  public vaultInterface: Interface;
  handlers: {
    [event: string]: (event: any, pool: PoolState, log: Log) => PoolState;
  } = {};

  pools: {
    [type: string]: PrimaryIssuePool | SecondaryIssuePool;
  };

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
    this.vaultInterface = new Interface(VAULTABI);
    this.addressesSubscribed = [vaultAddress];
    const primaryIssuePool = new PrimaryIssuePool(
      this.vaultAddress,
      this.vaultInterface,
    );
    const secondaryIssuePool = new SecondaryIssuePool(
      this.vaultAddress,
      this.vaultInterface,
    );
    this.logDecoder = (log: Log) => this.vaultInterface.parseLog(log);
    this.pools = {};
    this.pools[VerifiedPoolTypes.PrimaryIssuePool] = primaryIssuePool;
    this.pools[VerifiedPoolTypes.SecondaryIssuePool] = secondaryIssuePool;
    this.handlers['Swap'] = this.handleSwap.bind(this);
    this.handlers['PoolBalanceChanged'] =
      this.handlePoolBalanceChanged.bind(this);
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
        tokensMap: pool.tokens.reduce(
          (acc, token) => ({ ...acc, [token.address.toLowerCase()]: token }),
          {},
        ),
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

        return this.pools[pool.poolType].getOnChainCalls(
          pool,
          this.vaultAddress,
        );
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

  //gets prices for from and to in a pool(primary or secondarypool) when buying or selling
  //amounnt must be an array with 0 as first element: [0n, amounts]
  getPricesPool(
    from: Token,
    to: Token,
    subgraphPool: SubgraphPoolBase,
    poolState: PoolState,
    amounts: bigint[],
    unitVolume: bigint,
    side: SwapSide,
    creator: string,
  ): { unit: bigint; prices: bigint[] } | null {
    if (!isSupportedPool(subgraphPool.poolType)) {
      this.logger.error(`Unsupported Pool Type: ${subgraphPool.poolType}`);
      return null;
    }
    const amountWithoutZero = amounts.slice(1);
    const poolPairData = this.pools[subgraphPool.poolType].parsePoolPairData(
      subgraphPool,
      poolState,
      from.address,
      to.address,
    );
    const checkedAmounts: bigint[] = new Array(amountWithoutZero.length).fill(
      0n,
    );
    let nonZeroAmountIndex = 0;
    for (const [i, amountIn] of amountWithoutZero.entries()) {
      if (amountIn != 0n) {
        nonZeroAmountIndex = i + 1;
        checkedAmounts[i] = amountIn;
      }
    }
    if (nonZeroAmountIndex === 0) return null;
    const isCurrencyIn = from.address === subgraphPool.currency;
    const unitResult =
      unitVolume === 0n
        ? 0n
        : side === SwapSide.SELL
        ? this.pools[subgraphPool.poolType].onSell(
            [unitVolume],
            poolPairData,
            isCurrencyIn,
            creator,
          )![0]
        : this.pools[subgraphPool.poolType].onBuy(
            [unitVolume],
            poolPairData,
            isCurrencyIn,
            creator,
          )![0];
    const prices: bigint[] = new Array(amounts.length).fill(0n);
    const outputs =
      side === SwapSide.SELL
        ? this.pools[subgraphPool.poolType].onSell(
            amountWithoutZero.slice(0, nonZeroAmountIndex),
            poolPairData,
            isCurrencyIn,
            creator,
          )
        : this.pools[subgraphPool.poolType].onBuy(
            amountWithoutZero.slice(0, nonZeroAmountIndex),
            poolPairData,
            isCurrencyIn,
            creator,
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
}
