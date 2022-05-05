import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import _ from 'lodash';
import {
  Token,
  Address,
  ExchangePrices,
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
} from '../../constants';
import { StablePool, WeightedPool } from './balancer-v2-pool';
import { PhantomStablePool } from './PhantomStablePool';
import { LinearPool } from './LinearPool';
import VaultABI from '../../abi/balancer-v2/vault.json';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { wrapETH, getDexKeysWithNetwork, getBigIntPow } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  PoolState,
  SubgraphPoolBase,
  BalancerV2Data,
  BalancerParam,
  OptimizedBalancerV2Data,
  SwapTypes,
  DexParams,
  PoolStateMap,
} from './types';
import { getTokenScalingFactor } from './utils';
import { SimpleExchange } from '../simple-exchange';
import { BalancerConfig, Adapters } from './config';

const fetchAllPools = `query ($count: Int) {
  pools: pools(first: $count, orderBy: totalLiquidity, orderDirection: desc, where: {swapEnabled: true, poolType_in: ["MetaStable", "Stable", "Weighted", "LiquidityBootstrapping", "Investment", "StablePhantom", "AaveLinear", "ERC4626Linear"]}) {
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

// These should match the Balancer Pool types available on Subgraph
enum BalancerPoolTypes {
  Weighted = 'Weighted',
  Stable = 'Stable',
  MetaStable = 'MetaStable',
  LiquidityBootstrapping = 'LiquidityBootstrapping',
  Investment = 'Investment',
  AaveLinear = 'AaveLinear',
  StablePhantom = 'StablePhantom',
  ERC4626Linear = 'ERC4626Linear',
}

const subgraphTimeout = 1000 * 10;
const BALANCER_V2_CHUNKS = 10;
const MAX_POOL_CNT = 1000; // Taken from SOR
const POOL_CACHE_TTL = 60 * 60; // 1hr

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

  addressesSubscribed: string[];

  eventSupportedPoolTypes = [
    'Stable',
    'Weighted',
    'LiquidityBootstrapping',
    'Investment',
  ];

  constructor(
    protected parentName: string,
    protected network: number,
    protected vaultAddress: Address,
    protected subgraphURL: string,
    protected dexHelper: IDexHelper,
    logger: Logger,
  ) {
    super(parentName, logger);
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
    this.pools[BalancerPoolTypes.StablePhantom] = stablePhantomPool;
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
    const cacheKey = 'AllSubgraphPools';
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
      subgraphTimeout,
    );

    if (!(data && data.pools))
      throw new Error('Unable to fetch pools from the subgraph');

    this.dexHelper.cache.setex(
      this.parentName,
      this.network,
      cacheKey,
      POOL_CACHE_TTL,
      JSON.stringify(data.pools),
    );
    const allPools = data.pools;
    this.logger.info(
      `Got ${allPools.length} ${this.parentName}_${this.network} pools from subgraph`,
    );
    return allPools;
  }

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
    pool: SubgraphPoolBase,
    poolState: PoolState,
    amounts: bigint[],
    unitVolume: bigint,
    side: SwapSide,
  ): { unit: bigint; prices: bigint[] } | null {
    if (!this.isSupportedPool(pool.poolType)) {
      console.error(`Unsupported Pool Type: ${pool.poolType}`);
      return null;
    }

    const _amounts = [unitVolume, ...amounts.slice(1)];

    const poolPairData = this.pools[pool.poolType].parsePoolPairData(
      pool,
      poolState,
      from.address,
      to.address,
    );

    if (
      !this.pools[pool.poolType].checkBalance(
        amounts,
        unitVolume,
        side,
        poolPairData as any,
      )
    )
      return null;

    const _prices = this.pools[pool.poolType].onSell(
      _amounts,
      poolPairData as any,
    );
    return { unit: _prices[0], prices: [0n, ..._prices.slice(1)] };
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

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(BalancerConfig);

  logger: Logger;

  constructor(
    protected network: Network,
    protected dexKey: string,
    protected dexHelper: IDexHelper,
    protected vaultAddress: Address = BalancerConfig[dexKey][network]
      .vaultAddress,
    protected subgraphURL: string = BalancerConfig[dexKey][network].subgraphURL,
    protected adapters = Adapters[network],
  ) {
    super(dexHelper.augustusAddress, dexHelper.provider);
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
    const poolState = await this.eventPools.generateState(blockNumber);
    this.eventPools.setState(poolState, blockNumber);
    this.dexHelper.blockManager.subscribeToLogs(
      this.eventPools,
      this.eventPools.addressesSubscribed,
      blockNumber,
    );
  }

  async initializePricing(blockNumber: number) {
    await this.setupEventPools(blockNumber);
  }

  getPools(from: Token, to: Token): SubgraphPoolBase[] {
    return this.eventPools.allPools
      .filter(
        p =>
          p.tokens.some(
            token => token.address.toLowerCase() === from.address.toLowerCase(),
          ) &&
          p.tokens.some(
            token => token.address.toLowerCase() === to.address.toLowerCase(),
          ),
      )
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
    const _from = wrapETH(from, this.network);
    const _to = wrapETH(to, this.network);

    const pools = this.getPools(_from, _to);

    return pools.map(
      ({ address }) => `${this.dexKey}_${address.toLowerCase()}`,
    );
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
      const _from = wrapETH(from, this.network);
      const _to = wrapETH(to, this.network);

      const allPools = this.getPools(_from, _to);
      const allowedPools = limitPools
        ? allPools.filter(({ address }) =>
            limitPools.includes(`${this.dexKey}_${address.toLowerCase()}`),
          )
        : allPools;

      if (!allowedPools.length) return null;

      const unitVolume = getBigIntPow(
        (side === SwapSide.SELL ? _from : _to).decimals,
      );

      const quoteUnitVolume = getBigIntPow(
        (side === SwapSide.SELL ? _to : _from).decimals,
      );

      const poolStates = await this.eventPools.getState(blockNumber);
      if (!poolStates) {
        this.logger.error(`getState returned null`);
        return null;
      }

      const missingPools = allowedPools.filter(
        pool => !(pool.address.toLowerCase() in poolStates),
      );

      const missingPoolsStateMap = missingPools.length
        ? await this.eventPools.getOnChainState(missingPools, blockNumber)
        : {};

      const poolPrices = allowedPools
        .map((pool: SubgraphPoolBase) => {
          const poolAddress = pool.address.toLowerCase();
          const poolState =
            poolStates[poolAddress] || missingPoolsStateMap[poolAddress];
          if (!poolState) {
            this.logger.error(`Unable to find the poolState ${poolAddress}`);
            return null;
          }
          // TODO: re-check what should be the current block time stamp
          try {
            const res = this.eventPools.getPricesPool(
              _from,
              _to,
              pool,
              poolState,
              amounts,
              unitVolume,
              side,
            );
            if (!res) return;
            return {
              unit: res.unit,
              prices: res.prices,
              data: {
                poolId: pool.id,
              },
              poolAddresses: [poolAddress],
              exchange: this.dexKey,
              gasCost: 150 * 1000,
              poolIdentifier: `${this.dexKey}_${poolAddress}`,
            };
          } catch (e) {
            this.logger.error(
              `Error_getPrices ${from.symbol || from.address}, ${
                to.symbol || to.address
              }, ${side}, ${pool.address}:`,
              e,
            );
            return null;
          }
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
    // BalancerV2 Uses Address(0) as ETH
    const assets = [srcToken, destToken].map(t =>
      t.toLowerCase() === ETHER_ADDRESS.toLowerCase() ? NULL_ADDRESS : t,
    );

    const swaps = data.swaps.map(s => ({
      poolId: s.poolId,
      assetInIndex: 0,
      assetOutIndex: 1,
      amount: s.amount,
      userData: '0x',
    }));

    const funds = {
      sender: this.augustusAddress,
      recipient: this.augustusAddress,
      fromInternalBalance: false,
      toInternalBalance: false,
    };

    const limits = [MAX_INT, MAX_INT];

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

  async getTopPoolsForToken(
    tokenAddress: Address,
    count: number,
  ): Promise<PoolLiquidity[]> {
    const variables = {
      tokens: [tokenAddress],
      count,
    };

    const query = `query ($tokens: [Bytes!], $count: Int) {
      pools (first: $count, orderBy: totalLiquidity, orderDirection: desc,
           where: {tokensList_contains: $tokens,
                   swapEnabled: true,
                   totalLiquidity_gt: 0}) {
        address
        totalLiquidity
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
      subgraphTimeout,
    );

    if (!(data && data.pools))
      throw new Error(
        `Error_${this.dexKey}_Subgraph: couldn't fetch the pools from the subgraph`,
      );

    const pools = _.map(data.pools, (pool: any) => ({
      exchange: this.dexKey,
      address: pool.address.toLowerCase(),
      connectorTokens: pool.tokens.reduce(
        (
          acc: Token[],
          { decimals, address }: { decimals: number; address: string },
        ) => {
          if (address.toLowerCase() != tokenAddress.toLowerCase())
            acc.push({ decimals, address: address.toLowerCase() });
          return acc;
        },
        [],
      ),
      liquidityUSD: parseFloat(pool.totalLiquidity),
    }));

    return pools;
  }
}
