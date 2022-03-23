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
  OptimizedBalancerV1Data,
  BalancerParam,
  BalancerFunctions,
  PoolStates,
  Token,
} from './types';
import { SimpleExchange } from '../simple-exchange';
import { BalancerV1Config, Adapters } from './config';
import BalancerV1ABI from '../../abi/BalancerV1.json';
import BalancerCustomMulticallABI from '../../abi/BalancerCustomMulticall.json';
import { AxiosResponse } from 'axios';
import { Pool as OldPool } from '@balancer-labs/sor/dist/types';

// These are required to filter out log calls from the event calls
const LogCallTopics = [
  '0xb02f0b7300000000000000000000000000000000000000000000000000000000',
  '0x5db3427700000000000000000000000000000000000000000000000000000000',
  '0x46ab38f100000000000000000000000000000000000000000000000000000000',
  '0x4f69c0d400000000000000000000000000000000000000000000000000000000',
  '0x8201aa3f00000000000000000000000000000000000000000000000000000000',
  '0x7c5e9ea400000000000000000000000000000000000000000000000000000000',
  '0x34e1990700000000000000000000000000000000000000000000000000000000',
  '0x49b5955200000000000000000000000000000000000000000000000000000000',
  '0x4bb278f300000000000000000000000000000000000000000000000000000000',
  '0x3fdddaa200000000000000000000000000000000000000000000000000000000',
  '0xe4e1e53800000000000000000000000000000000000000000000000000000000',
  '0xcf5e7bd300000000000000000000000000000000000000000000000000000000',
  '0x02c9674800000000000000000000000000000000000000000000000000000000',
];

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

const poolUrls: { [key: number]: string } = {
  1: 'https://storageapi.fleek.co/balancer-bucket/balancer-exchange/pools',
  42: 'https://storageapi.fleek.co/balancer-bucket/balancer-exchange-kovan/pools',
};

const defaultfactoryAddress = '0x9424B1412450D0f8Fc2255FAf6046b98213B76Bd';
const defaultMulticallAddress = '0x514053acec7177e277b947b1ebb5c08ab4c4580e';

const POOL_FETCH_TIMEOUT = 5000;

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
    balancerMultiAddress: string,
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
      let tokens: Token[] = [];

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
      this.multicallAddress,
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

  // Original Implementation: https://github.com/balancer-labs/balancer-sor/blob/v1.0.0-1/src/helpers.ts
  // No change has been made. This function doesn't exist in older SOR and is needed to convert the new SOR Pool
  // to the older SOR Pool. The new SOR has the datatype PoolPairData which is equivalent to old SOR datatype
  // Pool.
  parsePoolPairData(
    p: PoolState,
    tokenIn: string,
    tokenOut: string,
  ): OldPool | null {
    let tI = p.tokens.find(
      t => t.address.toLowerCase() === tokenIn.toLowerCase(),
    );
    // logger.debug("tI", tI.balance.toString(), tI);
    let tO = p.tokens.find(
      t => t.address.toLowerCase() === tokenOut.toLowerCase(),
    );

    // logger.debug("tO", tO.balance.toString()), tO);
    if (!tI || !tO) return null;

    let poolPairData = {
      id: p.id,
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      decimalsIn: tI.decimals,
      decimalsOut: tO.decimals,
      balanceIn: bmath.bnum(tI.balance.toString()),
      balanceOut: bmath.bnum(tO.balance.toString()),
      weightIn: bmath.scale(
        bmath
          .bnum(tI.denormWeight.toString())
          .div(bmath.bnum(p.totalWeight.toString())),
        18,
      ),
      weightOut: bmath.scale(
        bmath
          .bnum(tO.denormWeight.toString())
          .div(bmath.bnum(p.totalWeight.toString())),
        18,
      ),
      swapFee: bmath.bnum(p.swapFee.toString()),
    };

    return poolPairData;
  }

  // Has almost the same logic as getAllPoolDataOnChain
  // Modifies the balance of pools according to the on chain state
  // at a certain blockNumber
  async updatePoolState(): Promise<void> {
    const pools = this.eventPools.allPools;

    if (pools.length === 0) throw Error('There are no pools.');

    let addresses: string[][] = [];
    let total = 0;

    for (let i = 0; i < pools.length; i++) {
      let pool = pools[i];

      addresses.push([pool.id]);
      total++;
      pool.tokens.forEach(token => {
        addresses[i].push(token.address);
        total++;
      });
    }

    let results = await this.eventPools.balancerMulticall.methods
      .getPoolInfo(addresses, total)
      .call();

    let j = 0;
    for (let i = 0; i < pools.length; i++) {
      pools[i].tokens.forEach(token => {
        token.balance = bignumberify(bmath.bnum(results[j]));
        j++;
      });
    }
  }

  async getTopPools(
    from: Token,
    to: Token,
    side: SwapSide,
    pools: PoolState[],
    minBalance: bigint,
    routeID: number,
    usedPools: { [poolIdentifier: string]: number } | null,
    isStale: boolean,
    blockNumber: number,
  ) {
    const _minBalance = new BigNumber(minBalance.toString());
    // Limits are from MAX_IN_RATIO/MAX_OUT_RATIO in the pool contracts
    const checkBalance = (p: OldPool) =>
      (side === SwapSide.SELL ? p.balanceIn.div(2) : p.balanceOut.div(3)).gt(
        _minBalance,
      );
    const selectedPools = pools
      .map(p => this.parsePoolPairData(p, from.address, to.address))
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

    await this.updatePoolState(
      rawSelectedPools,
      this.multicallAddress,
      blockNumber,
    );

    return rawSelectedPools
      .map(p => this.parsePoolPairData(p, from.address, to.address))
      .filter(p => !!p && checkBalance(p)) as OldPool[];
  }

  // TODO: Check this function
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

      let state = this.eventPools.getState(blockNumber);
      let isStale = false;
      if (!state) {
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

  // TODO: Check this function
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {}
}
