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
import { SwapSide, Network, MAX_UINT_BIGINT } from '../../constants';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import {
  wrapETH,
  getDexKeysWithNetwork,
  isETHAddress,
  interpolate,
  bignumberify,
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
import BalancerV1ABI from '../../abi/BalancerV1.json';
import BalancerCustomMulticallABI from '../../abi/BalancerCustomMulticall.json';
import { AxiosResponse } from 'axios';
import { Pool as OldPool } from '@balancer-labs/sor/dist/types';
import { calcInGivenOut, calcOutGivenIn } from '@balancer-labs/sor/dist/bmath';
import { typecastReadOnlyPool } from './utils';
import { parsePoolPairData } from './sor-overload';

const balancerV1Interface = new Interface(BalancerV1ABI);

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
    protected adapters = Adapters[network] || {},
    protected factoryAddress: Address = defaultfactoryAddress,
    protected multicallAddress: Address = defaultMulticallAddress,
    protected balancerMultiInterface = new Interface(
      BalancerCustomMulticallABI,
    ),
  ) {
    super(parentName, logger);

    this.logDecoder = (log: Log) => balancerV1Interface.parseLog(log);
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
    const tokenAmountIn = event.args.tokenAmountIn.toString();
    pool.tokens = pool.tokens.map(token => {
      if (token.address.toLowerCase() === tokenIn)
        token.balance = token.balance.plus(tokenAmountIn);
      return token;
    });
    return pool;
  }

  handleExitPool(event: any, pool: PoolState, log: Log): PoolState {
    const tokenOut = event.args.tokenOut.toLowerCase();
    const tokenAmountOut = event.args.tokenAmountOut.toString();
    pool.tokens = pool.tokens.map(token => {
      if (token.address.toLowerCase() === tokenOut)
        token.balance = token.balance.minus(tokenAmountOut);
      return token;
    });
    return pool;
  }

  handleSwap(event: any, pool: PoolState, log: Log): PoolState {
    const tokenIn = event.args.tokenIn.toLowerCase();
    const tokenAmountIn = event.args.tokenAmountIn.toString();
    const tokenOut = event.args.tokenOut.toLowerCase();
    const tokenAmountOut = event.args.tokenAmountOut.toString();
    pool.tokens = pool.tokens.map(token => {
      if (token.address.toLowerCase() === tokenIn)
        token.balance = token.balance.plus(tokenAmountIn);
      else if (token.address.toLowerCase() === tokenOut)
        token.balance = token.balance.minus(tokenAmountOut);
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
        swapFee: bignumberify(
          bmath.scale(bmath.bnum(pools.pools[i].swapFee.toString()), 18),
        ),
        totalWeight: bignumberify(
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
          balance: bignumberify(bal),
          decimals: Number(token.decimals),
          denormWeight: bignumberify(
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
    const allPoolsNonZeroBalances = (
      await this.dexHelper.httpRequest.get<AxiosResponse<PoolStates>>(
        poolUrls[this.network],
        POOL_FETCH_TIMEOUT,
      )
    ).data;

    // It is important to the onchain query as the subgraph pool might not contain the
    // latest balance because of slow block processing time
    const allPoolsNonZeroBalancesChain = await this.getAllPoolDataOnChain(
      allPoolsNonZeroBalances,
      blockNumber,
    );

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
      return MAX_UINT_BIGINT;
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
    protected subgraphURL: string = BalancerV1Config[dexKey] &&
      BalancerV1Config[dexKey][network].subgraphURL,
    protected adapters = Adapters[network] || {},
  ) {
    super(dexHelper.augustusAddress, dexHelper.provider);
    this.logger = dexHelper.getLogger(dexKey);
    this.eventPools = new BalancerV1EventPool(
      dexKey,
      network,
      dexHelper,
      this.logger,
      adapters,
    );
    this.exchangeRouterInterface = new Interface(BalancerV1ABI);
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

    const _from = wrapETH(srcToken, this.network);
    const _to = wrapETH(destToken, this.network);

    const pools = this.getPools(_from, _to);

    return pools.map(({ id }) => BalancerV1.getIdentifier(this.dexKey, id));
  }

  async updatePoolState(
    pools?: PoolState[],
    blockNumber?: number,
  ): Promise<void> {
    const _pools = pools === undefined ? this.eventPools.allPools : pools;

    if (_pools.length === 0) throw Error('There are no pools.');

    let addresses: string[][] = [];
    let total = 0;

    for (let i = 0; i < _pools.length; i++) {
      let pool = _pools[i];

      addresses.push([pool.id]);
      total++;
      pool.tokens.forEach(token => {
        addresses[i].push(token.address);
        total++;
      });
    }

    let results = await this.eventPools.balancerMulticall.methods
      .getPoolInfo(addresses, total)
      .call({}, blockNumber);

    let j = 0;
    for (let i = 0; i < _pools.length; i++) {
      _pools[i].tokens.forEach(token => {
        token.balance = bignumberify(bmath.bnum(results[j]));
        j++;
      });
    }
  }

  getPools(from: Token, to: Token, limit: number = 10): PoolState[] {
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
      .slice(0, limit);
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
      const _from = wrapETH(srcToken, this.network);
      const _to = wrapETH(destToken, this.network);

      const allPools = this.getPools(_from, _to);
      const allowedPools = limitPools
        ? allPools.filter(({ id }) =>
            limitPools.includes(BalancerV1.getIdentifier(this.dexKey, id)),
          )
        : allPools;

      if (!allowedPools.length) return null;

      const unitVolume = BigInt(
        10 ** (side === SwapSide.SELL ? _from : _to).decimals,
      );

      const poolStates = this.eventPools.getState(blockNumber);
      if (!poolStates) {
        this.logger.error(`getState returned null`);
        return null;
      }

      const missingPools = allowedPools.filter(
        pool => !(pool.id.toLowerCase() in poolStates),
      );

      const missingPoolStates = missingPools.length
        ? await this.eventPools.getAllPoolDataOnChain(
            { pools: missingPools },
            blockNumber,
          )
        : { pools: [] };

      const missingPoolStateMaps: PoolStateMap = {};
      missingPoolStates.pools.forEach(
        pool => (missingPoolStateMaps[pool.id.toLowerCase()] = pool),
      );

      const poolPrices = allowedPools
        .map(async pool => {
          const poolAddress = pool.id.toLowerCase();
          const poolState =
            poolStates[poolAddress] || missingPoolStateMaps[poolAddress];
          if (!poolState) {
            this.logger.error(`Unable to find the poolState ${poolAddress}`);
            return null;
          }
          const parsedOldPool = parsePoolPairData(
            pool,
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
