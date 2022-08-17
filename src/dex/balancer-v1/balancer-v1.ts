import { Interface, LogDescription } from '@ethersproject/abi';
import { Contract } from 'web3-eth-contract';
import { DeepReadonly } from 'ts-essentials';
import BigNumber from 'bignumber.js';
import _ from 'lodash';
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
  PoolStateMap,
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
  LogCallTopics,
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

const balancerV1PoolIface = new Interface(BalancerV1PoolABI);

export class BalancerV1PoolState extends StatefulEventSubscriber<PoolState> {
  private handlers: Record<
    string,
    (event: LogDescription, blockNumber: number) => void
  > = {};

  constructor(
    parentName: string,
    dexHelper: IDexHelper,
    logger: Logger,
    private address: string,
  ) {
    super(`${parentName}_${address}`, dexHelper, logger, true);

    this.handlers['LOG_JOIN'] = this.handleJoinPool.bind(this);
    this.handlers['LOG_EXIT'] = this.handleExitPool.bind(this);
    this.handlers['LOG_SWAP'] = this.handleSwap.bind(this);
  }

  protected processLog(
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    return null;
  }

  async generateState(blockNumber: number): Promise<Readonly<PoolState>> {
    return this.getState(blockNumber)! as Readonly<PoolState>;
  }

  handleEvent(event: LogDescription, blockNumber: number) {
    if (event.name in this.handlers) {
      this.handlers[event.name](event, blockNumber);
    }
  }

  handleJoinPool(event: LogDescription, blockNumber: number): void {
    const pool = typecastReadOnlyPool(this.getState(blockNumber));

    const tokenIn = event.args.tokenIn.toLowerCase();
    const tokenAmountIn = biginterify(event.args.tokenAmountIn.toString());
    pool.tokens = pool.tokens.map(token => {
      if (token.address.toLowerCase() === tokenIn)
        token.balance = token.balance + tokenAmountIn;
      return token;
    });

    this.setState(pool, blockNumber);
  }

  handleExitPool(event: LogDescription, blockNumber: number): void {
    const pool = typecastReadOnlyPool(this.getState(blockNumber));

    const tokenOut = event.args.tokenOut.toLowerCase();
    const tokenAmountOut = biginterify(event.args.tokenAmountOut.toString());
    pool.tokens = pool.tokens.map(token => {
      if (token.address.toLowerCase() === tokenOut)
        token.balance = token.balance - tokenAmountOut;
      return token;
    });

    this.setState(pool, blockNumber);
  }

  handleSwap(event: LogDescription, blockNumber: number): void {
    const pool = typecastReadOnlyPool(this.getState(blockNumber));

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

export class BalancerV1EventPool extends StatefulEventSubscriber<PoolStateMap> {
  handlers: {
    [event: string]: (event: any, pool: PoolState, log: Log) => PoolState;
  } = {};

  logDecoder: (log: Log) => any;

  poolStateMap: Record<string, BalancerV1PoolState> = {};

  balancerMulticall: Contract;

  constructor(
    protected parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    protected factoryAddress: Address = defaultfactoryAddress,
    protected multicallAddress: Address = defaultMulticallAddress,
  ) {
    super(parentName, dexHelper, logger);

    this.logDecoder = (log: Log) => balancerV1PoolIface.parseLog(log);
    this.addressesSubscribed = []; // Will be filled in generateState function
    this.balancerMulticall = new dexHelper.web3Provider.eth.Contract(
      BalancerCustomMulticallABI as any,
      this.multicallAddress,
    );
  }

  protected processLog(
    state: DeepReadonly<PoolStateMap>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolStateMap> | null {
    if (log.address == this.factoryAddress) {
      // Handle factory events
    } else {
      if (LogCallTopics.includes(log.topics[0])) {
        // TODO: handle special log calls
      } else {
        try {
          const event = this.logDecoder(log);
          const pool = this.poolStateMap[log.address.toLowerCase()];
          if (pool) {
            pool.handleEvent(event, log.blockNumber);
          } else {
            this.logger.warn(`missing pool for log received ${log.address}`);
          }
        } catch (e) {
          this.logger.error(
            `Error_${this.name}_processLog could not parse the log with topic ${log.topics}:`,
            e,
          );
        }
      }
    }
    return {};
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

  async setupEventPools(blockNumber: number) {
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

    // It is important to the onchain query as the subgraph pool might not contain the
    // latest balance because of slow block processing time
    const allPoolsNonZeroBalancesChain = await this.getAllPoolDataOnChain(
      allPoolsNonZeroBalances,
      blockNumber,
    );

    allPoolsNonZeroBalancesChain.pools.forEach(pool => {
      const address = pool.id.toLowerCase();
      const poolState = new BalancerV1PoolState(
        this.parentName,
        this.dexHelper,
        this.logger,
        address,
      );
      poolState.setState(pool, blockNumber);

      this.poolStateMap[address] = poolState;
      this.addressesSubscribed.push(address);
    });
    this.addressesSubscribed.push(this.factoryAddress);

    this.initialize(blockNumber);
  }

  async generateState(blockNumber: number): Promise<Readonly<PoolStateMap>> {
    const allPoolsNonZeroBalances =
      await this.dexHelper.httpRequest.get<PoolStates>(
        poolUrls[this.network],
        POOL_FETCH_TIMEOUT,
      );

    // It is important to the onchain query as the subgraph pool might not contain the
    // latest balance because of slow block processing time
    const allPoolsNonZeroBalancesChain = await this.getAllPoolDataOnChain(
      allPoolsNonZeroBalances,
      blockNumber,
    );
    allPoolsNonZeroBalancesChain.pools.forEach(pool => {
      const statePool = this.poolStateMap[pool.id.toLowerCase()];
      statePool.setState(pool, blockNumber);
    });

    return {};
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

  async getTopPools(
    from: Token,
    to: Token,
    side: SwapSide,
    pools: PoolState[],
    minBalance: bigint,
    isStale: boolean,
    blockNumber: number,
    limit: number = 10,
  ) {
    const _minBalance = new BigNumber(minBalance.toString());
    // Limits are from MAX_IN_RATIO/MAX_OUT_RATIO in the pool contracts
    const checkBalance = (p: OldPool) =>
      (side === SwapSide.SELL ? p.balanceIn.div(2) : p.balanceOut.div(3)).gt(
        _minBalance,
      );
    const selectedPools = pools
      .map(p => parsePoolPairData(p, from.address, to.address))
      .sort(
        (p1, p2) =>
          parseFloat(
            p2!.balanceOut.times(1e18).idiv(p2!.weightOut).toFixed(0),
          ) -
          parseFloat(p1!.balanceOut.times(1e18).idiv(p1!.weightOut).toFixed(0)),
      )
      .slice(0, limit) as OldPool[];

    if (!selectedPools || !selectedPools.length) return null;
    // This function mapFromOldPoolToPoolState is very extensive as it iterates
    // pools.length * selectedPools.length. But it shouldn't be a problem since
    // we limit to 10 before this
    if (!isStale) return mapFromOldPoolToPoolState(selectedPools, pools);

    const rawSelectedPools = pools.filter(p =>
      selectedPools.some(sp => p.id.toLowerCase() === sp.id.toLowerCase()),
    );
    await updatePoolState(
      rawSelectedPools,
      this.balancerMulticall,
      blockNumber,
    );
    const topOldPools = rawSelectedPools
      .map(p => parsePoolPairData(p, from.address, to.address))
      .filter(p => !!p && checkBalance(p));

    // This function mapFromOldPoolToPoolState is very extensive as it iterates
    // pools.length * selectedPools.length. But it shouldn't be a problem since
    // we limit to 10 before this
    return mapFromOldPoolToPoolState(topOldPools, rawSelectedPools);
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
    await this.eventPools.setupEventPools(blockNumber);
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

    let isStale = false;
    const poolsWithTokens = Object.values(this.eventPools.poolStateMap)
      .map<PoolState | null>(pool => {
        const state = pool.getState(blockNumber);
        if (!state) {
          this.logger.warn(`Warning_getPrices: Stale state being used`);
          isStale = true;
          return pool.getStaleState() as PoolState;
        }
        return state as PoolState;
      })
      .filter(pool => pool !== null)
      .filter(pool => {
        const tokenAddresses = pool!.tokens.map(token => token.address);

        return (
          tokenAddresses.includes(_from.address) &&
          tokenAddresses.includes(_to.address)
        );
      }) as PoolState[];

    const unitVolume = BigInt(
      10 ** (side === SwapSide.SELL ? _from : _to).decimals,
    );

    const topPools = await this.eventPools.getTopPools(
      _from,
      _to,
      side,
      poolsWithTokens,
      unitVolume,
      isStale,
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

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<BalancerV1Data>> {
    try {
      const _from = this.dexHelper.config.wrapETH(srcToken);
      const _to = this.dexHelper.config.wrapETH(destToken);

      let isStale = false;
      const allPools = Object.values(this.eventPools.poolStateMap)
        .map(pool => {
          const state = pool.getState(blockNumber);
          if (!state) {
            isStale = true;
            return pool.getStaleState();
          }
          return state;
        })
        .filter(pool => pool !== null)
        .map(pool => typecastReadOnlyPool(pool));

      const unitVolume = BigInt(
        10 ** (side === SwapSide.SELL ? _from : _to).decimals,
      );

      let minBalance = amounts[amounts.length - 1];
      if (unitVolume > minBalance) minBalance = unitVolume;

      const allowedPools = limitPools
        ? allPools.filter(({ id }) =>
            limitPools.includes(BalancerV1.getIdentifier(this.dexKey, id)),
          )
        : await this.eventPools.getTopPools(
            _from,
            _to,
            side,
            allPools,
            minBalance,
            isStale,
            blockNumber,
          );

      if (!allowedPools || !allowedPools.length) return null;

      const poolPrices = allowedPools
        .map(pool => {
          const poolAddress = pool.id.toLowerCase();
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
              poolAddresses: [poolAddress],
              exchange: this.dexKey,
              gasCost: BALANCER_SWAP_GAS_COST,
              poolIdentifier: BalancerV1.getIdentifier(
                this.dexKey,
                poolAddress,
              ),
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
