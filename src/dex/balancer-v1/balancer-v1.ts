import { Interface } from '@ethersproject/abi';
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
import { SwapSide, Network, MAX_UINT } from '../../constants';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import {
  getDexKeysWithNetwork,
  isETHAddress,
  interpolate,
  biginterify,
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
  SUBGRAPH_TIMEOUT,
  BALANCER_CHUNKS,
  BALANCER_SWAP_GAS_COST,
} from './config';
const BalancerV1PoolABI = require('../../abi/BalancerV1Pool.json');
const BalancerV1ExchangeProxyABI = require('../../abi/BalancerV1ExchangeProxy.json');
import BalancerCustomMulticallABI from '../../abi/BalancerCustomMulticall.json';
import { AxiosResponse } from 'axios';
import { Pool as OldPool } from '@balancer-labs/sor/dist/types';
import { calcInGivenOut, calcOutGivenIn } from '@balancer-labs/sor/dist/bmath';
import { mapFromOldPoolToPoolState, typecastReadOnlyPool } from './utils';
import { parsePoolPairData, updatePoolState } from './sor-overload';

const balancerV1PoolIface = new Interface(BalancerV1PoolABI);

export class BalancerV1EventPool extends StatefulEventSubscriber<PoolStateMap> {
  handlers: {
    [event: string]: (event: any, pool: PoolState, log: Log) => PoolState;
  } = {};

  logDecoder: (log: Log) => any;

  public allPools: PoolState[] = [];

  addressesSubscribed: string[];

  balancerMulticall: Contract;

  constructor(
    protected parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    protected factoryAddress: Address = defaultfactoryAddress,
    protected multicallAddress: Address = defaultMulticallAddress,
  ) {
    super(parentName, logger);

    this.logDecoder = (log: Log) => balancerV1PoolIface.parseLog(log);
    this.addressesSubscribed = []; // Will be filled in generateState function
    this.balancerMulticall = new dexHelper.web3Provider.eth.Contract(
      BalancerCustomMulticallABI as any,
      this.multicallAddress,
    );

    // Add handlers
    this.handlers['LOG_JOIN'] = this.handleJoinPool.bind(this);
    this.handlers['LOG_EXIT'] = this.handleExitPool.bind(this);
    this.handlers['LOG_SWAP'] = this.handleSwap.bind(this);
  }

  protected processLog(
    state: DeepReadonly<PoolStateMap>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolStateMap> | null {
    const _state: PoolStateMap = {};
    for (let pool of Object.values(state))
      _state[pool.id] = typecastReadOnlyPool(pool);

    if (log.address == this.factoryAddress) {
      // Handle factory events
    } else {
      if (LogCallTopics.includes(log.topics[0])) {
        // TODO: handle special log calls
      } else {
        try {
          const event = this.logDecoder(log);
          if (event.name in this.handlers)
            _state[log.address.toLowerCase()] = this.handlers[event.name](
              event,
              _state[log.address.toLowerCase()],
              log,
            );
        } catch (e) {
          this.logger.error(
            `Error_${this.name}_processLog could not parse the log with topic ${log.topics}:`,
            e,
          );
        }
      }
    }
    return _state;
  }

  handleJoinPool(event: any, pool: PoolState, log: Log): PoolState {
    const tokenIn = event.args.tokenIn.toLowerCase();
    const tokenAmountIn = biginterify(event.args.tokenAmountIn.toString());
    pool.tokens = pool.tokens.map(token => {
      if (token.address.toLowerCase() === tokenIn)
        token.balance = token.balance + tokenAmountIn;
      return token;
    });
    return pool;
  }

  handleExitPool(event: any, pool: PoolState, log: Log): PoolState {
    const tokenOut = event.args.tokenOut.toLowerCase();
    const tokenAmountOut = biginterify(event.args.tokenAmountOut.toString());
    pool.tokens = pool.tokens.map(token => {
      if (token.address.toLowerCase() === tokenOut)
        token.balance = token.balance - tokenAmountOut;
      return token;
    });
    return pool;
  }

  handleSwap(event: any, pool: PoolState, log: Log): PoolState {
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
    return pool;
  }

  async getAllPoolDataOnChain(
    pools: PoolStates,
    blockNumber: number,
  ): Promise<PoolStates> {
    if (pools.pools.length === 0) throw Error('There are no pools.');

    let addresses: string[][] = [];
    let total = 0;

    for (let i = 0; i < pools.pools.length; i++) {
      let pool = pools.pools[i];

      addresses.push([pool.id]);
      total++;
      pool.tokens.forEach(token => {
        addresses[i].push(token.address);
        total++;
      });
    }

    let results = await this.balancerMulticall.methods
      .getPoolInfo(addresses, total)
      .call({}, blockNumber);

    let j = 0;
    let onChainPools: PoolStates = { pools: [] };

    for (let i = 0; i < pools.pools.length; i++) {
      let tokens: SORToken[] = [];

      let p: PoolState = {
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
        let bal = bmath.bnum(results[j]);
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

  async generateState(blockNumber: number): Promise<Readonly<PoolStateMap>> {
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

    this.allPools = allPoolsNonZeroBalancesChain.pools;

    let poolStateMap: PoolStateMap = {};
    allPoolsNonZeroBalancesChain.pools.forEach(
      pool => (poolStateMap[pool.id.toLowerCase()] = pool),
    );
    // Subscribe to all the pools and the factory contract
    this.addressesSubscribed = Object.keys(poolStateMap);
    this.addressesSubscribed.push(this.factoryAddress);
    return poolStateMap;
  }

  async getPoolPrices(pool: OldPool, side: SwapSide, amount: bigint) {
    if (
      side === SwapSide.BUY &&
      amount * BigInt(2) > BigInt(pool.balanceOut.toFixed(0))
    ) {
      return BigInt(MAX_UINT);
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

    const poolsWithTokens = this.eventPools.allPools.filter(pool => {
      const tokenAddresses = pool.tokens.map(token => token.address);

      return (
        tokenAddresses.includes(_from.address) &&
        tokenAddresses.includes(_to.address)
      );
    });

    let poolStates = this.eventPools.getState(blockNumber);
    let isStale = false;
    if (!poolStates) {
      poolStates = this.eventPools.getStaleState();
      if (!poolStates) {
        this.logger.error(
          'Error_getPrices: Neither updated nor stale state found',
        );
        return poolsWithTokens
          .slice(0, 10)
          .map(({ id }) => BalancerV1.getIdentifier(this.dexKey, id));
      }
      isStale = true;
      this.logger.warn('Warning_getPrices: Stale state being used');
    }

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

  async getPoolPrices(
    amounts: bigint[],
    side: SwapSide,
    unitVolume: bigint,
    exchangeProxy: Address,
    pool: OldPool | null,
  ): Promise<PoolPrices<BalancerV1Data> | null> {
    if (!pool) return null;
    try {
      let unit = await this.eventPools.getPoolPrices(pool, side, unitVolume);

      const _width = Math.floor((amounts.length - 1) / BALANCER_CHUNKS);
      const _amounts = Array.from(Array(BALANCER_CHUNKS).keys()).map(
        i => amounts[(i + 1) * _width],
      );

      const _prices = await Promise.all(
        _amounts.map(a => this.eventPools.getPoolPrices(pool, side, a)),
      );

      const prices = interpolate(_amounts, _prices, amounts, side);

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

      let poolStates = this.eventPools.getState(blockNumber);
      let isStale = false;
      if (!poolStates) {
        poolStates = this.eventPools.getStaleState();
        if (!poolStates) {
          this.logger.error(
            'Error_getPrices: Neither updated nor stale state found',
          );
          return null;
        }
        isStale = true;
        this.logger.warn('Warning_getPrices: Stale state being used');
      }

      const unitVolume = BigInt(
        10 ** (side === SwapSide.SELL ? _from : _to).decimals,
      );

      const allPools = Object.values(poolStates).map(typecastReadOnlyPool);
      let minBalance = amounts[amounts.length - 1];
      if (unitVolume > minBalance) minBalance = unitVolume;

      const allowedPools = limitPools
        ? this.eventPools.allPools.filter(({ id }) =>
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

      const poolPrices = await Promise.all(
        allowedPools
          .map(async pool => {
            const poolAddress = pool.id.toLowerCase();
            const poolState = poolStates![poolAddress];
            if (!poolState) {
              this.logger.error(`Unable to find the poolState ${poolAddress}`);
              return null;
            }
            const parsedOldPool = parsePoolPairData(
              typecastReadOnlyPool(poolState),
              _from.address,
              _to.address,
            );

            // TODO: re-check what should be the current block time stamp
            try {
              const res = await this.getPoolPrices(
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
          .filter(p => !!p),
      );
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
        BigInt(0),
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
