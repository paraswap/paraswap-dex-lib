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
import { SwapSide, Network } from '../../constants';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { wrapETH, getDexKeysWithNetwork, isETHAddress } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  BalancerV1Data,
  PoolState,
  DexParams,
  PoolStateMap,
  SubgraphPoolBase,
  OptimizedBalancerV1Data,
  BalancerParam,
  BalancerFunctions,
} from './types';
import { SimpleExchange } from '../simple-exchange';
import { BalancerV1Config, Adapters } from './config';
import BalancerV1ABI from '../../abi/BalancerV1.json';
import { getAllPublicSwapPools } from './sor-overload';

const MAX_POOL_CNT = 1000; // Taken from SOR
const balancerV1Interface = new Interface(BalancerV1ABI);
const POOL_CACHE_TTL = 60 * 60; // 1hr

function typecastReadOnlyPoolState(pool: DeepReadonly<PoolState>): PoolState {
  return _.cloneDeep(pool) as PoolState;
}

const bignumberify = (val: any) => new BigNumber(val);

export function typecastReadOnlyToken(readOnlyToken: any): Token {
  return {
    address: readOnlyToken.address,
    balance: bignumberify(readOnlyToken.balance),
    decimals: readOnlyToken.decimals,
    denormWeight: bignumberify(readOnlyToken.denormWeight),
  };
}

export function typecastReadOnlyPool(readOnlyPool: any): PoolState {
  return {
    id: readOnlyPool.id,
    swapFee: bignumberify(readOnlyPool.swapFee),
    totalWeight: bignumberify(readOnlyPool.totalWeight),
    tokens: readOnlyPool.tokens.map(typecastReadOnlyToken),
    tokensList: readOnlyPool.tokensList,
  };
}

export class BalancerV1EventPool extends StatefulEventSubscriber<PoolStateMap> {
  handlers: {
    [event: string]: (event: any, pool: PoolState, log: Log) => PoolState;
  } = {};

  logDecoder: (log: Log) => any;

  public allPools: SubgraphPoolBase[] = [];

  addressesSubscribed: string[];

  constructor(
    protected parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    protected subgraphURL: string,
    protected adapters = Adapters[network] || {},
  ) {
    super(parentName, logger);

    this.logDecoder = (log: Log) => balancerV1Interface.parseLog(log);
    this.addressesSubscribed = [
      // TODO: Here to be all pools addresses?
    ];

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

  async generateState(blockNumber: number): Promise<Readonly<PoolState>> {
    // It is quicker to querry the static url for all the pools than querrying the subgraph
    // but the url doesn't take into account the blockNumber hence for testing purpose
    // the state should be passed to the setup function call.
    // const allPoolsNonZeroBalances: SubGraphPools = await getAllPublicPools(blockNumber);
    // const poolsHelper = new SOR.POOLS();
    const allPoolsNonZeroBalances = await getAllPublicSwapPools(
      poolUrls[this.network],
    );
    // It is important to the onchain querry as the subgraph pool might not contain the
    // latest balance because of slow block processing time
    const allPoolsNonZeroBalancesChain = await getAllPoolDataOnChain(
      allPoolsNonZeroBalances,
      this.multicallAddress,
      this.web3Provider as Web3Provider,
      blockNumber,
    );

    let poolState: PoolState = {};
    allPoolsNonZeroBalancesChain.pools.forEach(
      pool => (poolState[pool.id.toLowerCase()] = pool),
    );
    // Subscribe to all the pools and the factory contract
    this.addressesSubscribed = Object.keys(poolState);
    this.addressesSubscribed.push(this.factoryAddress);
    return poolState;
  }

  // async generateState(blockNumber: number): Promise<Readonly<PoolStateMap>> {
  //   const allPools = await this.fetchAllSubgraphPools();
  //   this.allPools = allPools;
  //   const allPoolsLatestState = await this.getOnChainState(
  //     eventSupportedPools,
  //     blockNumber,
  //   );
  //   return allPoolsLatestState;
  // }
}

export class BalancerV1
  extends SimpleExchange
  implements IDex<BalancerV1Data | OptimizedBalancerV1Data, DexParams>
{
  protected eventPools: BalancerV1EventPool;

  readonly hasConstantPriceLargeAmounts = false;

  readonly exchangeRouterInterface: Interface;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(BalancerV1Config);

  logger: Logger;

  constructor(
    protected network: Network,
    protected dexKey: string,
    protected dexHelper: IDexHelper,
    protected subgraphURL: string | undefined = BalancerV1Config[dexKey] &&
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
      subgraphURL,
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

  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    await this.setupEventPools(blockNumber);
  }

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] || null;
  }

  /* DONE: No need to check */
  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    if (srcToken.address.toLowerCase() === destToken.address.toLowerCase()) {
      return [];
    }

    const tokenAddress = [
      srcToken.address.toLowerCase(),
      destToken.address.toLowerCase(),
    ]
      .sort((a, b) => (a > b ? 1 : -1))
      .join('_');

    const poolIdentifier = `${this.dexKey}_${tokenAddress}`;
    return [poolIdentifier];
  }

  // Returns pool prices for amounts.
  // If limitPools is defined only pools in limitPools
  // should be used. If limitPools is undefined then
  // any pools can be used.
  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<BalancerV1Data>> {
    try {
      const from = wrapETH(srcToken, this.network);
      const to = wrapETH(destToken, this.network);

      let state = this.eventPools.getState(this.blockNumber);
      let isStale = false;
      if (!state) {
        if (this.eventPools.isFetching) {
          this.logger.error(
            'Error_getPrices: Pools state fetching still in process',
          );
          return null;
        } else {
          state = this.eventPools.getStaleState();
          if (!state) {
            this.logger.error(
              'Error_getPrices: Neither updated nor stale state found',
            );
            return null;
          }
          isStale = true;
          this.logger.warn('Warning_getPrices: Stale state being used');
        }
      }

      const unitVolume = BigInt(
        10 ** (side === SwapSide.SELL ? from : to).decimals,
      );
      const pools = Object.values(state).map(typecastReadOnlyPool);
      let minBalance = amounts[amounts.length - 1];
      if (unitVolume > minBalance) minBalance = unitVolume;

      const topPools = await this.getTopPools(
        from,
        to,
        side,
        pools,
        minBalance,
        routeID,
        usedPools,
        isStale,
        this.blockNumber,
      );
      if (!topPools || !topPools.length) return null;

      const rates = (
        await Promise.all(
          topPools.map(p =>
            this.getPoolPrices(
              from,
              to,
              amounts,
              side,
              unitVolume,
              this.exchangeProxy,
              p,
            ),
          ),
        )
      ).filter(r => !!r) as PoolPrices<BalancerData>[];

      return rates;
    } catch (e) {
      if (this.blockNumber === 0)
        this.logger.error(
          `Error_getPrices: Aurelius block manager not yet instantiated`,
        );
      this.logger.error('Error_getPrices:', e);
      return null;
    }
  }

  /* DONE: No need to check */
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

  /* DONE: No need to check */
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

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {


    const _minBalance = new BigNumber(minBalance.toString());
    // Limits are from MAX_IN_RATIO/MAX_OUT_RATIO in the pool contracts
    const checkBalance = (p: OldPool) =>
      (side === SwapSide.SELL ? p.balanceIn.div(2) : p.balanceOut.div(3)).gt(
        _minBalance,
      );
    const selectedPools = pools
      .map(p => parsePoolPairData(p, from.address, to.address))
      .filter(
        p =>
          !!p &&
          (!usedPools || usedPools[`Balancer_${p.id}`] === routeID) &&
          checkBalance(p),
      )
      .sort(
        (p1, p2) =>
          parseFloat(
            p2!.balanceOut.times(1e18).idiv(p2!.weightOut).toFixed(0),
          ) -
          parseFloat(p1!.balanceOut.times(1e18).idiv(p1!.weightOut).toFixed(0)),
      )
      .slice(0, 10) as OldPool[];

    if (!selectedPools || !selectedPools.length) return null;
    if (!isStale) return selectedPools;

    const rawSelectedPools = pools.filter(p =>
      selectedPools.some(sp => p.id.toLowerCase() === sp.id.toLowerCase()),
    );

    await updatePoolState(
      rawSelectedPools,
      this.multicallAddress,
      this.web3Provider as Web3Provider,
      blockNumber,
    );

    return rawSelectedPools
      .map(p => parsePoolPairData(p, from.address, to.address))
      .filter(p => !!p && checkBalance(p)) as OldPool[];
  }
}
