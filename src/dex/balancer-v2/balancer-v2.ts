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
  DexConfigMap,
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
import StablePoolABI from '../../abi/balancer-v2/stable-pool.json';
import WeightedPoolABI from '../../abi/balancer-v2/weighted-pool.json';
import MetaStablePoolABI from '../../abi/balancer-v2/meta-stable-pool.json';
import VaultABI from '../../abi/balancer-v2/vault.json';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { wrapETH, getDexKeysWithNetwork } from '../../utils';
import { IDexComplete } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  TokenState,
  PoolState,
  SubgraphToken,
  SubgraphPoolBase,
  BalancerSwapsV2,
  BalancerV2Data,
  BalancerFunds,
  BalancerSwap,
  BalancerParam,
  OptimizedBalancerV2Data,
  SwapTypes,
  DexParams,
} from './types';
import { SimpleExchange } from '../simple-exchange';

const fetchAllPools = `query ($count: Int) {
  pools: pools(first: $count, orderBy: totalLiquidity, orderDirection: desc, where: {swapEnabled: true, poolType_in: ["MetaStable", "Stable", "Weighted", "LiquidityBootstrapping", "Investment"]}) {
    id
    address
    poolType
    tokens {
      address
      decimals
    }
  }
}`;

const subgraphTimeout = 1000 * 10;
const BALANCER_V2_CHUNKS = 10;
const MAX_POOL_CNT = 1000; // Taken from SOR
const POOL_CACHE_TTL = 60 * 60; // 1hr

const BalancerConfig: DexConfigMap<DexParams> = {
  balancerv2: {
    [Network.MAINNET]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-v2',
      vaultAddress: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
    },
    [Network.POLYGON]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-polygon-v2',
      vaultAddress: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
    },
  },
  beetsfi: {
    [Network.FANTOM]: {
      subgraphURL:
        'https://graph-node.beets-ftm-node.com/subgraphs/name/beethovenx',
      vaultAddress: '0x20dd72ed959b6147912c2e529f0a0c651c33c9ce',
    },
  },
};

const Adapters: { [chainId: number]: { name: string; index: number }[] } = {
  [Network.MAINNET]: [
    {
      name: 'Adapter02',
      index: 9,
    },
  ],
  [Network.POLYGON]: [
    {
      name: 'PolygonAdapter01',
      index: 9,
    },
  ],
  [Network.FANTOM]: [
    {
      name: 'FantomAdapter01',
      index: 5,
    },
  ],
};

export type PoolStateMap = { [address: string]: PoolState };

function typecastReadOnlyPoolState(pool: DeepReadonly<PoolState>): PoolState {
  return _.cloneDeep(pool) as PoolState;
}

export class BalancerV2EventPool extends StatefulEventSubscriber<PoolStateMap> {
  public vaultInterface: Interface;

  handlers: {
    [event: string]: (event: any, pool: PoolState, log: Log) => PoolState;
  } = {};

  poolMaths: { [type: string]: any };
  poolInterfaces: { [type: string]: Interface };

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
    };
    this.poolInterfaces = {
      Stable: new Interface(StablePoolABI),
      Weighted: new Interface(WeightedPoolABI),
      MetaStable: new Interface(MetaStablePoolABI),
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
    const cacheKey = `${this.parentName}_AllSubgraphPools_${this.network}`;

    const cachedPools = await this.dexHelper.cache.get(cacheKey);
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
    const {
      data: { data },
    } = await this.dexHelper.httpRequest.post(
      this.subgraphURL,
      { query: fetchAllPools, variables },
      subgraphTimeout,
    );

    if (!(data && data.pools))
      throw new Error('Unable to fetch pools from the subgraph');

    this.dexHelper.cache.setex(
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
    // _MAX_IN_RATIO and _MAX_OUT_RATIO is set to 30% of the pool liquidity
    const checkBalance = (balanceIn: bigint, balanceOut: bigint) =>
      ((side === SwapSide.SELL ? balanceIn : balanceOut) * BigInt(3)) /
        BigInt(10) >
      (amounts[amounts.length - 1] > unitVolume
        ? amounts[amounts.length - 1]
        : unitVolume);

    // const scaleBN = (val: string, d: number) =>
    //   BigInt(new BigNumber(val).times(10 ** d).toFixed(0));
    const _amounts = [unitVolume, ...amounts.slice(1)];

    switch (pool.poolType) {
      case 'MetaStable':
      case 'Stable': {
        const indexIn = pool.tokens.findIndex(
          t => t.address.toLowerCase() === from.address.toLowerCase(),
        );
        const indexOut = pool.tokens.findIndex(
          t => t.address.toLowerCase() === to.address.toLowerCase(),
        );
        const balances = pool.tokens.map(
          t => poolState.tokens[t.address.toLowerCase()].balance,
        );
        if (!checkBalance(balances[indexIn], balances[indexOut])) return null;

        const scalingFactors =
          pool.poolType === 'MetaStable'
            ? pool.tokens.map(
                t => poolState.tokens[t.address.toLowerCase()].scalingFactor,
              )
            : pool.tokens.map(t => BigInt(10 ** (18 - t.decimals)));

        const _prices = this.poolMaths['Stable'].onSell(
          _amounts,
          balances,
          indexIn,
          indexOut,
          scalingFactors,
          poolState.swapFee,
          poolState.amp,
        );
        return { unit: _prices[0], prices: [BigInt(0), ..._prices.slice(1)] };
      }
      case 'Weighted':
      case 'LiquidityBootstrapping':
      case 'Investment': {
        const inAddress = from.address.toLowerCase();
        const outAddress = to.address.toLowerCase();

        const tokenIn = pool.tokens.find(
          t => t.address.toLowerCase() === inAddress,
        );
        const tokenOut = pool.tokens.find(
          t => t.address.toLowerCase() === outAddress,
        );

        if (!tokenIn || !tokenOut) return null;

        const tokenInBalance = poolState.tokens[inAddress].balance;
        const tokenOutBalance = poolState.tokens[outAddress].balance;
        if (!checkBalance(tokenInBalance, tokenOutBalance)) return null;

        const tokenInWeight = poolState.tokens[inAddress].weight;
        const tokenOutWeight = poolState.tokens[outAddress].weight;

        const tokenInScalingFactor = BigInt(10 ** (18 - tokenIn.decimals));
        const tokenOutScalingFactor = BigInt(10 ** (18 - tokenOut.decimals));

        const _prices = this.poolMaths['Weighted'].onSell(
          _amounts,
          tokenInBalance,
          tokenOutBalance,
          tokenInScalingFactor,
          tokenOutScalingFactor,
          tokenInWeight,
          tokenOutWeight,
          poolState.swapFee,
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
        let poolCallData = [
          {
            target: this.vaultAddress,
            callData: this.vaultInterface.encodeFunctionData('getPoolTokens', [
              pool.id,
            ]),
          },
          {
            target: pool.address,
            callData: this.poolInterfaces['Weighted'].encodeFunctionData(
              'getSwapFeePercentage',
            ), // different function for element pool
          },
        ];

        if (['MetaStable'].includes(pool.poolType)) {
          poolCallData.push({
            target: pool.address,
            callData:
              this.poolInterfaces['MetaStable'].encodeFunctionData(
                'getScalingFactors',
              ),
          });
        }
        if (
          ['Weighted', 'LiquidityBootstrapping', 'Investment'].includes(
            pool.poolType,
          )
        ) {
          poolCallData.push({
            target: pool.address,
            callData: this.poolInterfaces['Weighted'].encodeFunctionData(
              'getNormalizedWeights',
            ),
          });
        }
        if (['Stable', 'MetaStable'].includes(pool.poolType)) {
          poolCallData.push({
            target: pool.address,
            callData: this.poolInterfaces['Stable'].encodeFunctionData(
              'getAmplificationParameter',
            ),
          });
        }
        return poolCallData;
      })
      .flat();

    const data = await this.dexHelper.multiContract.aggregate(multiCallData, {
      blockTag: blockNumber,
    });

    let i = 0;
    const onChainStateMap = subgraphPoolBase.reduce(
      (acc: { [address: string]: PoolState }, pool) => {
        const poolTokens = this.vaultInterface.decodeFunctionResult(
          'getPoolTokens',
          data.returnData[i++],
        );

        const swapFee = this.poolInterfaces['Weighted'].decodeFunctionResult(
          'getSwapFeePercentage',
          data.returnData[i++],
        )[0];

        const scalingFactors = ['MetaStable'].includes(pool.poolType)
          ? this.poolInterfaces['MetaStable'].decodeFunctionResult(
              'getScalingFactors',
              data.returnData[i++],
            )[0]
          : undefined;

        const normalisedWeights = [
          'Weighted',
          'LiquidityBootstrapping',
          'Investment',
        ].includes(pool.poolType)
          ? this.poolInterfaces['Weighted'].decodeFunctionResult(
              'getNormalizedWeights',
              data.returnData[i++],
            )[0]
          : undefined;

        const amp = ['Stable', 'MetaStable'].includes(pool.poolType)
          ? this.poolInterfaces['Stable'].decodeFunctionResult(
              'getAmplificationParameter',
              data.returnData[i++],
            )
          : undefined;

        let poolState: PoolState = {
          swapFee: BigInt(swapFee.toString()),
          tokens: poolTokens.tokens.reduce(
            (
              ptAcc: { [address: string]: TokenState },
              pt: string,
              j: number,
            ) => {
              let tokenState: TokenState = {
                balance: BigInt(poolTokens.balances[j].toString()),
              };

              if (scalingFactors)
                tokenState.scalingFactor = BigInt(scalingFactors[j].toString());

              if (normalisedWeights)
                tokenState.weight = BigInt(normalisedWeights[j].toString());

              ptAcc[pt.toLowerCase()] = tokenState;
              return ptAcc;
            },
            {},
          ),
        };

        if (amp) {
          poolState.amp = BigInt(amp.value.toString());
        }

        acc[pool.address.toLowerCase()] = poolState;
        return acc;
      },
      {},
    );

    return onChainStateMap;
  }
}

export class BalancerV2
  extends SimpleExchange
  implements
    IDexComplete<BalancerV2Data, BalancerParam, OptimizedBalancerV2Data>
{
  protected eventPools: BalancerV2EventPool;

  readonly hasConstantPriceLargeAmounts = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(BalancerConfig);

  logger: Logger;

  protected constructor(
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

  async initialize(blockNumber: number) {
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

  getAdapters(): { name: string; index: number }[] {
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
            limitPools.includes(address.toLowerCase()),
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
    token: Token,
    count: number,
  ): Promise<PoolLiquidity[]> {
    const variables = {
      tokens: [token.address],
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
    const {
      data: { data },
    } = await this.dexHelper.httpRequest.post(this.subgraphURL, {
      query,
      variables,
    });

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
          if (address.toLowerCase() != token.address.toLowerCase())
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
