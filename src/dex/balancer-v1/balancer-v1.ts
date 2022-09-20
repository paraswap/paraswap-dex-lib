import { Interface, LogDescription } from '@ethersproject/abi';
import { Contract } from 'web3-eth-contract';
import { DeepReadonly } from 'ts-essentials';
import _ from 'lodash';
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
  catchParseLogError,
  getDexKeysWithNetwork,
  isETHAddress,
  sliceCalls,
} from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  BalancerV1Data,
  DexParams,
  OptimizedBalancerV1Data,
  BalancerParam,
  BalancerFunctions,
  Token as SORToken,
  PoolStatesAsString,
  PoolStateAsString,
  TokenAsString,
  MinimalPoolState,
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
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import BalancerV1PoolABI from '../../abi/BalancerV1Pool.json';
import BalancerV1ExchangeProxyABI from '../../abi/BalancerV1ExchangeProxy.json';

import BalancerCustomMulticallABI from '../../abi/BalancerCustomMulticall.json';
import { WeightedPool } from '@balancer-labs/sor/dist/index';
import { BI_MAX_INT } from '../../bigint-constants';
import { updatePoolState } from './sor-overload';
import BigNumber from 'bignumber.js';

//TODO: find out how to regenerate state for separated pools object
const balancerV1PoolIface = new Interface(BalancerV1PoolABI);

type GetPoolStateResult = {
  syncedPools: BalancerV1PoolState[];
  invalidPools: BalancerV1PoolState[];
};

type ValuePlusIndexType = {
  value: BigNumber;
  index: number;
};

const poolParseLog = (log: Log) => balancerV1PoolIface.parseLog(log);

export class BalancerV1PoolState extends StatefulEventSubscriber<MinimalPoolState> {
  private handlers: Record<
    string,
    (
      event: LogDescription,
      state: DeepReadonly<MinimalPoolState>,
      blockNumber: number,
    ) => MinimalPoolState
  > = {};

  private tokenAddressesSet = new Set<string>();

  public loadState(blockNumber: number): WeightedPool | null {
    const tokensObj = this.getState(blockNumber);
    if (!tokensObj) {
      return null;
    }

    const _tokens = tokensObj.tokens.map(token => ({
      address: token.address,
      decimals: token.decimals,
      balance: token.balance,
      weight: token.denormWeight,
    }));

    return new WeightedPool(
      this.pool.id,
      this.pool.id,
      this.pool.swapFee,
      this.pool.totalWeight,
      '0',
      _tokens,
      this.pool.tokensList,
    );
  }

  addressesSubscribed: string[] = [];

  constructor(
    dexHelper: IDexHelper,
    parentName: string,
    public pool: PoolStateAsString,
    public identifier: string,
    private balancerMulticall: Contract,
    logger: Logger,
  ) {
    super(parentName, logger);

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
    state: DeepReadonly<MinimalPoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<MinimalPoolState> | null {
    try {
      const event = poolParseLog(log);
      if (event.name in this.handlers) {
        return this.handlers[event.name](event, state, log.blockNumber);
      }
      return state;
    } catch (e) {
      catchParseLogError(e, this.logger);
    }

    return state;
  }

  /* not use because we prefer to use restoreState which batch multiple generate state in one  */
  async generateState(
    blockNumber: number,
  ): Promise<Readonly<MinimalPoolState>> {
    await updatePoolState([this.pool], this.balancerMulticall, blockNumber);
    return {
      tokens: this.pool.tokens,
    };
  }

  handleJoinPool(
    event: LogDescription,
    state: DeepReadonly<MinimalPoolState>,
  ): MinimalPoolState {
    const _state = _.cloneDeep(state) as MinimalPoolState;

    const tokenIn = event.args.tokenIn.toLowerCase();
    const tokenAmountIn = new BigNumber(event.args.tokenAmountIn.toString());
    _state.tokens = _state.tokens.map(token => {
      if (token.address.toLowerCase() === tokenIn) {
        token.balance = new BigNumber(token.balance)
          .plus(tokenAmountIn)
          .toString();
      }
      return token;
    });

    return _state;
  }

  handleExitPool(
    event: LogDescription,
    state: DeepReadonly<MinimalPoolState>,
  ): MinimalPoolState {
    const _state = _.cloneDeep(state) as MinimalPoolState;

    const tokenOut = event.args.tokenOut.toLowerCase();
    const tokenAmountOut = new BigNumber(event.args.tokenAmountOut.toString());
    _state.tokens = _state.tokens.map(token => {
      if (token.address.toLowerCase() === tokenOut)
        token.balance = new BigNumber(token.balance)
          .minus(tokenAmountOut)
          .toString();
      return token;
    });

    return _state;
  }

  handleSwap(
    event: LogDescription,
    state: DeepReadonly<MinimalPoolState>,
  ): MinimalPoolState {
    const _state = _.cloneDeep(state) as MinimalPoolState;

    const tokenIn = event.args.tokenIn.toLowerCase();
    const tokenAmountIn = new BigNumber(event.args.tokenAmountIn.toString());

    const tokenOut = event.args.tokenOut.toLowerCase();
    const tokenAmountOut = new BigNumber(event.args.tokenAmountOut.toString());
    _state.tokens = _state.tokens.map(token => {
      if (token.address.toLowerCase() === tokenIn)
        token.balance = new BigNumber(token.balance)
          .plus(tokenAmountIn)
          .toString();
      else if (token.address.toLowerCase() === tokenOut)
        token.balance = new BigNumber(token.balance)
          .minus(tokenAmountOut)
          .toString();
      return token;
    });

    return _state;
  }
}

export class BalancerV1EventPool {
  allpools: BalancerV1PoolState[] = [];

  private balancerMulticall: Contract;

  constructor(
    protected dexHelper: IDexHelper,
    private dexKey: string,
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
    pools: PoolStatesAsString,
    blockNumber: number,
  ): Promise<PoolStatesAsString> {
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
    const onChainPools: PoolStatesAsString = { pools: [] };

    for (let i = 0; i < pools.pools.length; i++) {
      const _pool = pools.pools[i];

      const tokens: TokenAsString[] = [];
      _pool.tokens.forEach(token => {
        const bal = poolTokensBalances[j];
        j++;
        tokens.push({
          address: token.address,
          balance: bal,
          decimals: Number(token.decimals),
          denormWeight: token.denormWeight,
        });
      });

      const p: PoolStateAsString = {
        id: _pool.id,
        swapFee: _pool.swapFee,
        totalWeight: _pool.totalWeight,
        tokens: tokens,
        tokensList: _pool.tokensList,
      };

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
      await this.dexHelper.httpRequest.get<PoolStatesAsString>(
        poolUrls[this.dexHelper.config.data.network],
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
        this.dexHelper,
        this.dexKey,
        pool,
        BalancerV1.getIdentifier(dexKey, pool.id),
        this.balancerMulticall,
        this.logger,
      );

      const tokensAsString: Readonly<MinimalPoolState> = {
        tokens: pool.tokens.map(t => {
          const tokenAsString = {
            address: t.address,
            balance: t.balance,
            decimals: t.decimals,
            denormWeight: t.denormWeight,
          };
          return tokenAsString;
        }),
      };

      poolState.setState(tokensAsString, blockNumber);
      this.dexHelper.blockManager.subscribeToLogs(
        poolState,
        poolState.addressesSubscribed,
        blockNumber,
      );

      this.allpools.push(poolState);
    });
  }

  getPoolPrices(
    from: Token,
    to: Token,
    pool: WeightedPool,
    poolData: any,
    side: SwapSide,
    amount: bigint,
  ) {
    if (
      side === SwapSide.BUY &&
      amount * 2n >
        BigInt(poolData.balanceOut.toString().slice(0, -to.decimals))
    ) {
      console.log(poolData.balanceOut.toString(), amount * 2n);
      console.log(BI_MAX_INT);
      return BI_MAX_INT;
    }
    const _amount = new BigNumber(amount.toString());
    const res =
      side === SwapSide.SELL
        ? pool._exactTokenInForTokenOut(poolData as any, _amount)
        : pool._tokenInForExactTokenOut(poolData as any, _amount);
    return BigInt(res.integerValue(BigNumber.ROUND_FLOOR).toString());
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

    pools.forEach((pool, index) => {
      const tokens: Readonly<MinimalPoolState> = {
        tokens: initialPoolsState[index].tokens,
      };
      pool.setState(tokens, blockNumber);
    });
  }

  syncGetTopPools(
    from: Token,
    to: Token,
    poolsState: BalancerV1PoolState[],
    _minBalance: bigint,
    side: SwapSide,
    blockNumber: number,
    limit: number = 10,
  ): BalancerV1PoolState[] | null {
    const minBalance = new BigNumber(_minBalance.toString());
    const valuesPlusIndexes = poolsState
      .slice(0, 15)
      .reduce<ValuePlusIndexType[]>((acc, pool, index) => {
        const weightedPool = pool.loadState(blockNumber);
        if (!weightedPool) {
          this.logger.error('missing state');
          return acc;
        }
        const poolData = weightedPool.parsePoolPairData(
          from.address,
          to.address,
        );

        const _balanceIn = poolData.balanceIn.toString();
        const _balanceOut = poolData.balanceOut.toString();
        const balanceIn = new BigNumber(
          _balanceIn.length > from.decimals
            ? _balanceIn.slice(0, -from.decimals)
            : 0,
        );
        const balanceOut = new BigNumber(
          _balanceOut.length > to.decimals
            ? _balanceOut.slice(0, -to.decimals)
            : 0,
        );

        if (side === SwapSide.SELL && balanceIn.div(2).lt(minBalance)) {
          return acc;
        }

        if (side === SwapSide.BUY && balanceOut.div(3).lt(minBalance)) {
          return acc;
        }

        const value = new BigNumber(
          balanceIn.div(new BigNumber(poolData.weightOut.toString())),
        );
        acc.push({
          value,
          index,
        });

        return acc;
      }, []);

    const selectedPools = valuesPlusIndexes.sort((p1, p2) => {
      return p2.value.gt(p1.value) ? 1 : -1;
    });

    if (!selectedPools || !selectedPools.length) return null;

    return selectedPools.slice(0, limit).map(pool => poolsState[pool.index]);
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
    this.eventPools = new BalancerV1EventPool(dexHelper, dexKey, this.logger);
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

    const poolsWithTokens = this.eventPools.allpools.filter(
      pool => pool.hasToken(_from) && pool.hasToken(_to),
    );

    const results = this.eventPools.syncGetPoolsState(
      poolsWithTokens,
      blockNumber,
    );

    if (results.invalidPools.length !== 0) {
      await this.eventPools.restoreState(results.invalidPools, blockNumber);
    }

    const unitVolume = BigInt(
      10 ** (side === SwapSide.SELL ? _from : _to).decimals,
    );

    const topPools = this.eventPools.syncGetTopPools(
      _from,
      _to,
      [...results.syncedPools, ...results.invalidPools],
      unitVolume,
      side,
      blockNumber,
    );

    if (!topPools) return [];

    return topPools.map(pool => pool.identifier);
  }

  getPoolPrices(
    from: Token,
    to: Token,
    amounts: bigint[],
    side: SwapSide,
    unitVolume: bigint,
    exchangeProxy: Address,
    pool: WeightedPool | null,
    poolData: any,
  ): PoolPrices<BalancerV1Data> | null {
    if (!pool) return null;
    try {
      const unit = this.eventPools.getPoolPrices(
        from,
        to,
        pool,
        poolData,
        side,
        unitVolume,
      );
      const prices = amounts.map(a =>
        this.eventPools.getPoolPrices(from, to, pool, poolData, side, a),
      );
      return {
        prices,
        unit,
        data: {
          poolId: pool.id,
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
    return this.eventPools.allpools.filter(pool => {
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

      let minBalance = amounts[amounts.length - 1];
      if (unitVolume > minBalance) minBalance = unitVolume;

      const topPools = this.eventPools.syncGetTopPools(
        _from,
        _to,
        [...results.syncedPools, ...results.invalidPools],
        minBalance,
        side,
        blockNumber,
        5,
      );

      if (!topPools || !topPools.length) return null;

      const poolPrices = topPools
        .map(pool => {
          const weightedPool = pool.loadState(blockNumber);
          if (!weightedPool) {
            return null;
          }
          const poolData = weightedPool.parsePoolPairData(
            _from.address,
            _to.address,
          );
          if (!poolData) {
            return null;
          }
          // TODO: re-check what should be the current block time stamp
          try {
            const res = this.getPoolPrices(
              _from,
              _to,
              amounts,
              side,
              unitVolume,
              this.exchangeProxy,
              weightedPool,
              poolData,
            );
            if (!res) return;
            return {
              unit: res.unit,
              prices: res.prices,
              data: {
                exchangeProxy: this.exchangeProxy,
                poolId: pool.pool.id,
              },
              poolAddresses: [pool.pool.id],
              exchange: this.dexKey,
              gasCost: BALANCER_SWAP_GAS_COST,
              poolIdentifier: pool.identifier,
            };
          } catch (e) {
            this.logger.error(
              `Error_getPrices ${srcToken.symbol || srcToken.address}, ${
                destToken.symbol || destToken.address
              }, ${side}, ${pool.pool}:`,
              e,
            );
            return null;
          }
        })
        .filter(p => !!p);
      return poolPrices as ExchangePrices<BalancerV1Data>;
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

  getCalldataGasCost(
    poolPrices: PoolPrices<BalancerV1Data | OptimizedBalancerV1Data>,
  ): number | number[] {
    return (
      CALLDATA_GAS_COST.DEX_OVERHEAD +
      CALLDATA_GAS_COST.LENGTH_SMALL +
      // ParentStruct header
      CALLDATA_GAS_COST.OFFSET_SMALL +
      // ParentStruct -> swaps[] header
      CALLDATA_GAS_COST.OFFSET_SMALL +
      // ParentStruct -> swaps[]
      CALLDATA_GAS_COST.LENGTH_SMALL +
      // ParentStruct -> swaps[0]
      CALLDATA_GAS_COST.ADDRESS +
      CALLDATA_GAS_COST.AMOUNT +
      CALLDATA_GAS_COST.AMOUNT +
      CALLDATA_GAS_COST.FULL_WORD
    );
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
