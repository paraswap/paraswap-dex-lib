import { Interface, LogDescription } from '@ethersproject/abi';
import { Contract } from 'web3-eth-contract';
import { DeepReadonly } from 'ts-essentials';
import BigNumber from 'bignumber.js';
import _, { add, result } from 'lodash';
import * as bmath from '@balancer-labs/sor/dist/bmath';
import {
  Address,
  ExchangePrices,
  Log,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
  Token,
  PoolPrices,
} from '../../types';
import { SwapSide, Network, SUBGRAPH_TIMEOUT } from '../../constants';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import {
  getDexKeysWithNetwork,
  isETHAddress,
  biginterify,
  sliceCalls,
} from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  BalancerV1Data,
  PoolState,
  DexParams,
  OptimizedBalancerV1Data,
  BalancerParam,
  BalancerFunctions,
  PoolStates,
  Token as SORToken,
} from './types';
import { SimpleExchange } from '../simple-exchange';
import {
  BalancerV1Config,
  Adapters,
  defaultfactoryAddress,
  defaultMulticallAddress,
  poolUrls,
  POOL_FETCH_TIMEOUT,
  BALANCER_SWAP_GAS_COST,
  BALANCER_V1_POOL_BALANCES_MULTICALL_SLICE_SIZE,
} from './config';
import BalancerV1PoolABI from '../../abi/BalancerV1Pool.json';
import BalancerV1ExchangeProxyABI from '../../abi/BalancerV1ExchangeProxy.json';

import BalancerCustomMulticallABI from '../../abi/BalancerCustomMulticall.json';
import { Pool as OldPool } from '@balancer-labs/sor/dist/types';
import { calcInGivenOut, calcOutGivenIn } from '@balancer-labs/sor/dist/bmath';
import { mapFromOldPoolToPoolState, typecastReadOnlyPool } from './utils';
import { parsePoolPairData, updatePoolState } from './sor-overload';
import { BI_MAX_INT } from '../../bigint-constants';

//TODO: find out how to regenerate state for separated pools object
const balancerV1PoolIface = new Interface(BalancerV1PoolABI);

type GetPoolStateResult = {
  syncedPools: BalancerV1PoolState[];
  invalidPools: BalancerV1PoolState[];
};

const poolParseLog = (log: Log) => balancerV1PoolIface.parseLog(log);

export class BalancerV1PoolState extends StatefulEventSubscriber<PoolState> {
  private handlers: Record<
    string,
    (
      event: LogDescription,
      state: DeepReadonly<PoolState>,
      blockNumber: number,
    ) => void
  > = {};

  private tokenAddressesSet = new Set<string>();

  constructor(
    parentName: string,
    dexHelper: IDexHelper,
    logger: Logger,
    public pool: PoolState,
    public identifier: string,
    private balancerMulticall: Contract,
  ) {
    super(`${parentName}_${pool.id}`, dexHelper, logger);

    this.addressesSubscribed.push(pool.id);
    this.handlers['LOG_JOIN'] = this.handleJoinPool.bind(this);
    this.handlers['LOG_EXIT'] = this.handleExitPool.bind(this);
    this.handlers['LOG_SWAP'] = this.handleSwap.bind(this);

    pool.tokens.forEach(token => {
      this.tokenAddressesSet.add(token.address);
    });
  }

  hasToken(token: Token) {
    return this.tokenAddressesSet.has(token.address);
  }

  protected processLog(
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    const event = poolParseLog(log);
    if (event.name in this.handlers) {
      this.handlers[event.name](event, state, log.blockNumber);
    }
    return null;
  }

  /* not use because we prefer to use restoreState which batch multiple generate state in one  */
  async generateState(blockNumber: number): Promise<Readonly<PoolState>> {
    await updatePoolState([this.pool], this.balancerMulticall, blockNumber);

    return this.pool;
  }

  handleJoinPool(
    event: LogDescription,
    state: DeepReadonly<PoolState>,
    blockNumber: number,
  ): void {
    const pool = typecastReadOnlyPool(state);

    const tokenIn = event.args.tokenIn.toLowerCase();
    const tokenAmountIn = biginterify(event.args.tokenAmountIn.toString());
    pool.tokens = pool.tokens.map(token => {
      if (token.address.toLowerCase() === tokenIn)
        token.balance = token.balance + tokenAmountIn;
      return token;
    });

    this.setState(pool, blockNumber);
  }

  handleExitPool(
    event: LogDescription,
    state: DeepReadonly<PoolState>,
    blockNumber: number,
  ): void {
    const pool = typecastReadOnlyPool(state);

    const tokenOut = event.args.tokenOut.toLowerCase();
    const tokenAmountOut = biginterify(event.args.tokenAmountOut.toString());
    pool.tokens = pool.tokens.map(token => {
      if (token.address.toLowerCase() === tokenOut)
        token.balance = token.balance - tokenAmountOut;
      return token;
    });

    this.setState(pool, blockNumber);
  }

  handleSwap(
    event: LogDescription,
    state: DeepReadonly<PoolState>,
    blockNumber: number,
  ): void {
    const pool = typecastReadOnlyPool(state);

    const tokenIn = event.args.tokenIn.toLowerCase();
    const tokenAmountIn = biginterify(event.args.tokenAmountIn.toString());
    const tokenOut = event.args.tokenOut.toLowerCase();
    const tokenAmountOut = biginterify(event.args.tokenAmountOut.toString());
    pool.tokens = pool.tokens.map(token => {
      if (token.address.toLowerCase() === tokenIn)
        token.balance = token.balance + tokenAmountIn;
      else if (token.address.toLowerCase() === tokenOut)
        token.balance = token.balance - tokenAmountOut;
      return token;
    });

    this.setState(pool, blockNumber);
  }
}

export class BalancerV1EventPool {
  poolStateMap: Record<string, BalancerV1PoolState> = {};

  private balancerMulticall: Contract;

  constructor(
    protected parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    protected logger: Logger,
    protected factoryAddress: Address = defaultfactoryAddress,
    protected multicallAddress: Address = defaultMulticallAddress,
  ) {
    this.balancerMulticall = new dexHelper.web3Provider.eth.Contract(
      BalancerCustomMulticallABI as any,
      this.multicallAddress,
    );
  }

  async getAllPoolDataOnChain(
    pools: PoolStates,
    blockNumber: number,
  ): Promise<PoolStates> {
    if (pools.pools.length === 0) throw Error('There are no pools.');

    const poolWithTokensAddresses: string[][] = [];

    for (let i = 0; i < pools.pools.length; i++) {
      const pool = pools.pools[i];

      poolWithTokensAddresses.push([pool.id]);
      pool.tokens.forEach(token => {
        poolWithTokensAddresses[i].push(token.address);
      });
    }

    // Note: slicing here is done on first dimension only. If one slice they are many pools with >2 tokens we can still reach error.
    // Won't address as case didn't show up and dex/protocol is deprecated.
    const poolTokensBalances = (
      await Promise.all(
        sliceCalls({
          inputArray: poolWithTokensAddresses,
          sliceLength: BALANCER_V1_POOL_BALANCES_MULTICALL_SLICE_SIZE,
          execute: async (slicedPoolWithTokensAddresses: string[][]) => {
            const totalTokensInPools = slicedPoolWithTokensAddresses.reduce(
              (acc, pool) => acc + pool.length - 1, // skip pool addresses, multicall would just append extra zero. This doesn't play nice with sharded calls
              0,
            );

            const slicedPoolTokensBalances =
              await this.balancerMulticall.methods
                .getPoolInfo(slicedPoolWithTokensAddresses, totalTokensInPools)
                .call({}, blockNumber);

            return slicedPoolTokensBalances;
          },
        }),
      )
    ).flat();

    let j = 0;
    const onChainPools: PoolStates = { pools: [] };

    for (let i = 0; i < pools.pools.length; i++) {
      const tokens: SORToken[] = [];

      const p: PoolState = {
        id: pools.pools[i].id,
        swapFee: biginterify(
          bmath.scale(bmath.bnum(pools.pools[i].swapFee.toString()), 18),
        ),
        totalWeight: biginterify(
          bmath.scale(bmath.bnum(pools.pools[i].totalWeight.toString()), 18),
        ),
        tokens: tokens,
        tokensList: pools.pools[i].tokensList,
      };

      pools.pools[i].tokens.forEach(token => {
        const bal = bmath.bnum(poolTokensBalances[j]);
        j++;
        p.tokens.push({
          address: token.address,
          balance: biginterify(bal),
          decimals: Number(token.decimals),
          denormWeight: biginterify(
            bmath.scale(bmath.bnum(token.denormWeight.toString()), 18),
          ),
        });
      });
      onChainPools.pools.push(p);
    }
    return onChainPools;
  }

  async setupEventPools(dexKey: string, blockNumber: number) {
    // It is quicker to query the static url for all the pools than querying the subgraph
    // but the url doesn't take into account the blockNumber hence for testing purpose
    // the state should be passed to the setup function call.
    // const allPoolsNonZeroBalances: SubGraphPools = await getAllPublicPools(blockNumber);
    // const poolsHelper = new SOR.POOLS();
    const allPoolsNonZeroBalances =
      await this.dexHelper.httpRequest.get<PoolStates>(
        poolUrls[this.network],
        POOL_FETCH_TIMEOUT,
      );

    // normalized all address to lowerCase
    allPoolsNonZeroBalances.pools.forEach(pool => {
      pool.id = pool.id.toLowerCase();
      pool.tokens.forEach((token, index) => {
        pool.tokens[index].address = token.address.toLowerCase();
      });
    });

    // It is important to the onchain query as the subgraph pool might not contain the
    // latest balance because of slow block processing time
    const allPoolsNonZeroBalancesChain = await this.getAllPoolDataOnChain(
      allPoolsNonZeroBalances,
      blockNumber,
    );

    allPoolsNonZeroBalancesChain.pools.forEach(pool => {
      const poolState = new BalancerV1PoolState(
        this.parentName,
        this.dexHelper,
        this.logger,
        pool,
        BalancerV1.getIdentifier(dexKey, pool.id),
        this.balancerMulticall,
      );
      poolState.setState(pool, blockNumber);
      poolState.initialize(blockNumber);

      this.poolStateMap[pool.id] = poolState;
    });
  }

  getPoolPrices(pool: OldPool, side: SwapSide, amount: bigint) {
    if (
      side === SwapSide.BUY &&
      amount * 2n > BigInt(pool.balanceOut.toFixed(0))
    ) {
      return BI_MAX_INT;
    }
    const _amount = new BigNumber(amount.toString());
    const res =
      side === SwapSide.SELL
        ? calcOutGivenIn(
            pool.balanceIn,
            pool.weightIn,
            pool.balanceOut,
            pool.weightOut,
            _amount as any,
            pool.swapFee,
          )
        : calcInGivenOut(
            pool.balanceIn,
            pool.weightIn,
            pool.balanceOut,
            pool.weightOut,
            _amount as any,
            pool.swapFee,
          );
    return BigInt(res.toFixed(0));
  }

  syncGetPoolsState(
    pools: BalancerV1PoolState[],
    blockNumber: number,
  ): GetPoolStateResult {
    return pools.reduce<GetPoolStateResult>(
      (acc, pool) => {
        const state = pool.getState(blockNumber);
        if (!state) {
          acc.invalidPools.push(pool);
        } else {
          acc.syncedPools.push(pool);
        }
        return acc;
      },
      {
        syncedPools: [],
        invalidPools: [],
      },
    );
  }

  async restoreState(pools: BalancerV1PoolState[], blockNumber: number) {
    const initialPoolsState = pools.map(pool => pool.pool);

    await updatePoolState(
      initialPoolsState,
      this.balancerMulticall,
      blockNumber,
    );

    pools.forEach(pool => {
      pool.setState(pool.pool, blockNumber);
    });
  }

  syncGetTopPools(
    from: Token,
    to: Token,
    poolsState: PoolState[],
    limit: number = 10,
  ): PoolState[] | null {
    const selectedPools = poolsState
      .map(p => parsePoolPairData(p, from.address, to.address))
      .sort(
        (p1, p2) =>
          parseFloat(
            p2!.balanceOut.times(1e18).idiv(p2!.weightOut).toFixed(0),
          ) -
          parseFloat(p1!.balanceOut.times(1e18).idiv(p1!.weightOut).toFixed(0)),
      ) as OldPool[];

    if (!selectedPools || !selectedPools.length) return null;
    return mapFromOldPoolToPoolState(selectedPools, poolsState).slice(0, limit);
  }
}

export class BalancerV1
  extends SimpleExchange
  implements IDex<BalancerV1Data | OptimizedBalancerV1Data, DexParams>
{
  protected eventPools: BalancerV1EventPool;

  readonly hasConstantPriceLargeAmounts = false;

  readonly exchangeRouterInterface: Interface;

  readonly exchangeProxy: Address =
    '0x6317c5e82a06e1d8bf200d21f4510ac2c038ac81';

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(BalancerV1Config);

  logger: Logger;

  constructor(
    protected network: Network,
    protected dexKey: string,
    protected dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
    protected subgraphURL: string = BalancerV1Config[dexKey] &&
      BalancerV1Config[dexKey][network].subgraphURL,
  ) {
    super(dexHelper.config.data.augustusAddress, dexHelper.web3Provider);
    this.logger = dexHelper.getLogger(dexKey);
    this.eventPools = new BalancerV1EventPool(
      dexKey,
      network,
      dexHelper,
      this.logger,
    );
    this.exchangeRouterInterface = new Interface(BalancerV1ExchangeProxyABI);
  }

  async setupEventPools(blockNumber: number) {
    await this.eventPools.setupEventPools(this.dexKey, blockNumber);
  }

  async initializePricing(blockNumber: number) {
    await this.setupEventPools(blockNumber);
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] || null;
  }

  static getIdentifier(dexKey: string, address: string) {
    return `${dexKey}_${address.toLowerCase()}`;
  }

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    if (srcToken.address.toLowerCase() === destToken.address.toLowerCase())
      return [];

    const _from = this.dexHelper.config.wrapETH(srcToken);
    const _to = this.dexHelper.config.wrapETH(destToken);

    _from.address = _from.address.toLowerCase();
    _to.address = _to.address.toLowerCase();

    const poolsWithTokens = Object.values(this.eventPools.poolStateMap).filter(
      pool => pool.hasToken(_from) && pool.hasToken(_to),
    );

    const results = this.eventPools.syncGetPoolsState(
      poolsWithTokens,
      blockNumber,
    );

    if (results.invalidPools.length !== 0) {
      await this.eventPools.restoreState(results.invalidPools, blockNumber);
    }

    const topPools = this.eventPools.syncGetTopPools(
      _from,
      _to,
      [...results.syncedPools, ...results.invalidPools].map(
        pool => pool.getState(blockNumber) as PoolState,
      ),
      blockNumber,
    );

    if (!topPools) return [];

    return topPools.map(({ id }) => BalancerV1.getIdentifier(this.dexKey, id));
  }

  getPoolPrices(
    amounts: bigint[],
    side: SwapSide,
    unitVolume: bigint,
    exchangeProxy: Address,
    pool: OldPool | null,
  ): PoolPrices<BalancerV1Data> | null {
    if (!pool) return null;
    try {
      const unit = this.eventPools.getPoolPrices(pool, side, unitVolume);
      const prices = amounts.map(a =>
        this.eventPools.getPoolPrices(pool, side, a),
      );

      return {
        prices,
        unit,
        data: {
          pool: pool.id,
          exchangeProxy,
        },
        poolAddresses: [pool.id],
        exchange: this.dexKey,
        poolIdentifier: BalancerV1.getIdentifier(this.dexKey, pool.id),
        gasCost: BALANCER_SWAP_GAS_COST,
      };
    } catch (e) {
      this.logger.error(`Error_getPoolPrices: ${pool.id}`, e);
      return null;
    }
  }

  private getPoolsSupportingPair(
    from: Token,
    to: Token,
  ): BalancerV1PoolState[] {
    return Object.values(this.eventPools.poolStateMap).filter(pool => {
      return pool.hasToken(from) && pool.hasToken(to);
    });
  }

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<BalancerV1Data>> {
    try {
      const start = Date.now();
      const _from = this.dexHelper.config.wrapETH(srcToken);
      const _to = this.dexHelper.config.wrapETH(destToken);

      _from.address = _from.address.toLowerCase();
      _to.address = _to.address.toLowerCase();

      let allowedPools = this.getPoolsSupportingPair(_from, _to);
      if (limitPools && limitPools.length !== 0) {
        allowedPools = allowedPools.filter(pool =>
          limitPools.includes(pool.identifier),
        );
      }

      const results = this.eventPools.syncGetPoolsState(
        allowedPools,
        blockNumber,
      );

      const unitVolume = BigInt(
        10 ** (side === SwapSide.SELL ? _from : _to).decimals,
      );

      if (results.invalidPools.length !== 0) {
        await this.eventPools.restoreState(results.invalidPools, blockNumber);
      }

      const topPools = this.eventPools.syncGetTopPools(
        _from,
        _to,
        [...results.syncedPools, ...results.invalidPools].map(
          p => p.getState(blockNumber) as PoolState,
        ),
        10,
      );

      if (!topPools || !topPools.length) return null;

      const poolPrices = topPools
        .map(pool => {
          const parsedOldPool = parsePoolPairData(
            typecastReadOnlyPool(pool),
            _from.address,
            _to.address,
          );

          // TODO: re-check what should be the current block time stamp
          try {
            const res = this.getPoolPrices(
              amounts,
              side,
              unitVolume,
              this.exchangeProxy,
              parsedOldPool,
            );
            if (!res) return;
            return {
              unit: res.unit,
              prices: res.prices,
              data: {
                poolId: pool.id,
                exchangeProxy: this.exchangeProxy,
              },
              poolAddresses: [pool.id],
              exchange: this.dexKey,
              gasCost: BALANCER_SWAP_GAS_COST,
              poolIdentifier: BalancerV1.getIdentifier(this.dexKey, pool.id),
            };
          } catch (e) {
            this.logger.error(
              `Error_getPrices ${srcToken.symbol || srcToken.address}, ${
                destToken.symbol || destToken.address
              }, ${side}, ${pool.id}:`,
              e,
            );
            return null;
          }
        })
        .filter(p => !!p);

      console.log(`elapsed ${Date.now() - start}`);
      return poolPrices as unknown as ExchangePrices<BalancerV1Data>;
    } catch (e) {
      this.logger.error(
        `Error_getPrices ${srcToken.symbol || srcToken.address}, ${
          destToken.symbol || destToken.address
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
    data: OptimizedBalancerV1Data,
    side: SwapSide,
  ): AdapterExchangeParam {
    const { swaps } = data;
    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          'swaps[]': {
            pool: 'address',
            tokenInParam: 'uint',
            tokenOutParam: 'uint',
            maxPrice: 'uint',
          },
        },
      },
      { swaps },
    );

    return {
      targetExchange: data.exchangeProxy,
      payload,
      networkFee: '0',
    };
  }

  getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: OptimizedBalancerV1Data,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const { swaps } = data;

    if (side === SwapSide.BUY) {
      // Need to adjust the swap input params to match the adjusted srcAmount
      const _srcAmount = BigInt(srcAmount);
      const totalInParam = swaps.reduce(
        (acc, swap) => acc + BigInt(swap.tokenInParam),
        0n,
      );
      swaps.forEach(swap => {
        swap.tokenInParam = (
          (BigInt(swap.tokenInParam) * _srcAmount) /
          totalInParam
        ).toString();
      });
    }

    const [swapFunction, swapFunctionParam] = ((): [
      swapFunction: string,
      swapFunctionParam: BalancerParam,
    ] => {
      if (side === SwapSide.SELL) {
        if (isETHAddress(srcToken))
          return [
            BalancerFunctions.batchEthInSwapExactIn,
            [swaps, destToken, destAmount],
          ];

        if (isETHAddress(destToken))
          return [
            BalancerFunctions.batchEthOutSwapExactIn,
            [swaps, srcToken, srcAmount, destAmount],
          ];

        return [
          BalancerFunctions.batchSwapExactIn,
          [swaps, srcToken, destToken, srcAmount, destAmount],
        ];
      } else {
        if (isETHAddress(srcToken))
          return [BalancerFunctions.batchEthInSwapExactOut, [swaps, destToken]];
        if (isETHAddress(destToken))
          return [
            BalancerFunctions.batchEthOutSwapExactOut,
            [swaps, srcToken, srcAmount],
          ];

        return [
          BalancerFunctions.batchSwapExactOut,
          [swaps, srcToken, destToken, srcAmount],
        ];
      }
    })();

    const swapData = this.exchangeRouterInterface.encodeFunctionData(
      swapFunction,
      swapFunctionParam,
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      data.exchangeProxy,
    );
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    const variables = {
      tokens: [tokenAddress],
      limit,
    };

    const query = `query ($tokens: [Bytes!], $limit: Int) {
      pools (first: $limit, orderBy: liquidity, orderDirection: desc,
           where: {tokensList_contains: $tokens,
                   active: true,
                   liquidity_gt: 0}) {
        id
        liquidity
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

    const pools = _.map(data.pools, (pool: any) => ({
      exchange: this.dexKey,
      address: pool.id.toLowerCase(),
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
      liquidityUSD: parseFloat(pool.liquidity),
    }));

    return pools;
  }
}
