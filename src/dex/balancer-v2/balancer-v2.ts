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
import { wrapETH, getDexKeysWithNetwork } from '../../utils';
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
  pools: pools(first: $count, orderBy: totalLiquidity, orderDirection: desc, where: {swapEnabled: true, poolType_in: ["MetaStable", "Stable", "Weighted", "LiquidityBootstrapping", "Investment", "StablePhantom", "AaveLinear"]}) {
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

  poolMaths: { [type: string]: any };

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
    this.poolMaths = {
      Stable: new StablePool(),
      Weighted: new WeightedPool(),
      StablePhantom: new PhantomStablePool(),
      AaveLinear: new LinearPool(),
    };
    this.vaultInterface = new Interface(VaultABI);
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

  getPricesPool(
    from: Token,
    to: Token,
    pool: SubgraphPoolBase,
    poolState: PoolState,
    amounts: bigint[],
    unitVolume: bigint,
    side: SwapSide,
  ): { unit: bigint; prices: bigint[] } | null {
    // const scaleBN = (val: string, d: number) =>
    //   BigInt(new BigNumber(val).times(10 ** d).toFixed(0));
    const _amounts = [unitVolume, ...amounts.slice(1)];

    switch (pool.poolType) {
      case 'MetaStable':
      case 'Stable': {
        const poolPairData = this.poolMaths['Stable'].parsePoolPairData(
          pool,
          poolState,
          from.address,
          to.address,
          pool.poolType === 'MetaStable',
        );
        if (
          !this.poolMaths['Stable'].checkBalance(
            poolPairData.balances[poolPairData.indexOut],
            poolPairData.scalingFactors[poolPairData.indexOut],
            amounts,
            unitVolume,
          )
        )
          return null;

        const _prices = this.poolMaths['Stable'].onSell(
          _amounts,
          poolPairData.balances,
          poolPairData.indexIn,
          poolPairData.indexOut,
          poolPairData.scalingFactors,
          poolPairData.swapFee,
          poolPairData.amp,
        );
        return { unit: _prices[0], prices: [BigInt(0), ..._prices.slice(1)] };
      }
      case 'Weighted':
      case 'LiquidityBootstrapping':
      case 'Investment': {
        const poolPairData = this.poolMaths['Weighted'].parsePoolPairData(
          pool,
          poolState,
          from.address,
          to.address,
        );

        if (
          !this.poolMaths['Weighted'].checkBalance(
            poolPairData.tokenInBalance,
            poolPairData.tokenOutBalance,
            side,
            amounts,
            unitVolume,
          )
        )
          return null;

        const _prices = this.poolMaths['Weighted'].onSell(
          _amounts,
          poolPairData.tokenInBalance,
          poolPairData.tokenOutBalance,
          poolPairData.tokenInScalingFactor,
          poolPairData.tokenOutScalingFactor,
          poolPairData.tokenInWeight,
          poolPairData.tokenOutWeight,
          poolPairData.swapFee,
        );
        return { unit: _prices[0], prices: [BigInt(0), ..._prices.slice(1)] };
      }

      case 'StablePhantom': {
        const poolPairData = this.poolMaths['StablePhantom'].parsePoolPairData(
          pool,
          poolState,
          from.address,
          to.address,
        );
        if (
          !this.poolMaths['StablePhantom'].checkBalance(
            poolPairData.balances[poolPairData.indexOut],
            poolPairData.scalingFactors[poolPairData.indexOut],
            amounts,
            unitVolume,
          )
        )
          return null;
        const _prices = this.poolMaths['StablePhantom'].onSell(
          _amounts,
          poolPairData.tokens,
          poolPairData.balances,
          poolPairData.indexIn,
          poolPairData.indexOut,
          poolPairData.bptIndex,
          poolPairData.scalingFactors,
          poolPairData.swapFee,
          poolPairData.amp,
        );
        return { unit: _prices[0], prices: [BigInt(0), ..._prices.slice(1)] };
      }

      case 'AaveLinear': {
        const poolPairData = this.poolMaths['AaveLinear'].parsePoolPairData(
          pool,
          poolState,
          from.address,
          to.address,
        );
        if (
          !this.poolMaths['AaveLinear'].checkBalance(
            poolPairData.balances[poolPairData.indexOut],
            poolPairData.scalingFactors[poolPairData.indexOut],
            amounts,
            unitVolume,
          )
        )
          return null;
        const _prices = this.poolMaths['AaveLinear'].onSell(
          _amounts,
          poolPairData.tokens,
          poolPairData.balances,
          poolPairData.indexIn,
          poolPairData.indexOut,
          poolPairData.bptIndex,
          poolPairData.wrappedIndex,
          poolPairData.mainIndex,
          poolPairData.scalingFactors,
          poolPairData.swapFee,
          poolPairData.lowerTarget,
          poolPairData.upperTarget,
        );
        return { unit: _prices[0], prices: [BigInt(0), ..._prices.slice(1)] };
      }
    }

    return null;
  }

  async getOnChainState(
    subgraphPoolBase: SubgraphPoolBase[],
    blockNumber: number,
  ): Promise<PoolStateMap> {
    const multiCallData = subgraphPoolBase
      .map(pool => {
        let poolCallData = [];
        if (
          ['Weighted', 'LiquidityBootstrapping', 'Investment'].includes(
            pool.poolType,
          )
        ) {
          // Will create onchain call data for WeightedPool types
          const weightedCalls = WeightedPool.getOnChainCalls(
            pool,
            this.vaultAddress,
            this.vaultInterface,
          );
          poolCallData.push(...weightedCalls);
        }

        if (['Stable'].includes(pool.poolType)) {
          // Will create onchain call data for StablePool
          const stableCalls = StablePool.getOnChainCalls(
            pool,
            this.vaultAddress,
            this.vaultInterface,
          );
          poolCallData.push(...stableCalls);
        }

        if (['AaveLinear'].includes(pool.poolType)) {
          // Will create onchain call data for linearPools
          const linearCalls = LinearPool.getOnChainCalls(
            pool,
            this.vaultAddress,
            this.vaultInterface,
          );
          poolCallData.push(...linearCalls);
        }

        if (['MetaStable', 'StablePhantom'].includes(pool.poolType)) {
          // Will create onchain call data for Meta/PhantomStablePool
          const metaStableCalls = PhantomStablePool.getOnChainCalls(
            pool,
            this.vaultAddress,
            this.vaultInterface,
          );
          poolCallData.push(...metaStableCalls);
        }

        return poolCallData;
      })
      .flat();

    // 500 is an arbitary number choosed based on the blockGasLimit
    const slicedMultiCallData = _.chunk(multiCallData, 500);

    // const returnData = (
    //   await Promise.all(
    //     slicedMultiCallData.map(async _multiCallData =>
    //       this.dexHelper.multiContract.callStatic.tryAggregate(
    //         false,
    //         _multiCallData,
    //         {
    //           blockTag: blockNumber,
    //         },
    //       ),
    //     ),
    //   )
    // ).flat();

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
        if (
          ['Weighted', 'LiquidityBootstrapping', 'Investment'].includes(
            pool.poolType,
          )
        ) {
          // This will decode multicall data for all pools associated with Weighted pools
          const [decoded, newIndex] = WeightedPool.decodeOnChainCalls(
            pool,
            this.vaultInterface,
            returnData,
            i,
          );
          i = newIndex;
          acc = { ...acc, ...decoded };
          return acc;
        }

        if (['AaveLinear'].includes(pool.poolType)) {
          // This will decode multicall data for all pools associated with linear pool
          const [decoded, newIndex] = LinearPool.decodeOnChainCalls(
            pool,
            this.vaultInterface,
            returnData,
            i,
          );
          i = newIndex;
          acc = { ...acc, ...decoded };
          return acc;
        }

        if (['Stable'].includes(pool.poolType)) {
          // This will decode multicall data for Stable pools
          const [decoded, newIndex] = StablePool.decodeOnChainCalls(
            pool,
            this.vaultInterface,
            returnData,
            i,
          );
          i = newIndex;
          acc = { ...acc, ...decoded };
          return acc;
        }

        if (['MetaStable', 'StablePhantom'].includes(pool.poolType)) {
          // This will decode multicall data for Meta/PhantomStable pools
          const [decoded, newIndex] = PhantomStablePool.decodeOnChainCalls(
            pool,
            this.vaultInterface,
            returnData,
            i,
          );
          i = newIndex;
          acc = { ...acc, ...decoded };
          return acc;
        }

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

      const unitVolume = BigInt(
        10 ** (side === SwapSide.SELL ? _from : _to).decimals,
      );

      const quoteUnitVolume = BigInt(
        10 ** (side === SwapSide.SELL ? _to : _from).decimals,
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
          // TODO: re-chech what should be the current block time stamp
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
