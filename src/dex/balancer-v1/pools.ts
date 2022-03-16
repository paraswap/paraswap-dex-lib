import { Interface } from '@ethersproject/abi';
import BigNumber from 'bignumber.js';
import BPool from '../../abi/balancer-v1/BPool.json';
import BFactory from '../../abi/balancer-v1/BFactory.json';
import { Logger } from 'log4js';
import { Address, Log, Token } from '../../types';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { AsyncOrSync, DeepReadonly } from 'ts-essentials';
import { SwapSide, MAX_UINT, MAX_UINT_BIGINT } from '../../constants';
import { BigNumber as BigNumberSor } from '@balancer-labs/sor/dist/utils/bignumber';
import {
  getAllPoolDataOnChain,
  parsePoolPairData,
  getCostOutputToken,
  Pool,
  SubGraphPools,
  Token as SORToken,
  getAllPublicSwapPools,
  updatePoolState,
} from './sor-overloads';

import {
  calcTotalOutput,
  calcTotalInput,
  formatSwapsExactAmountIn,
  formatSwapsExactAmountOut,
  processBalancers,
  processEpsOfInterest,
  smartOrderRouterEpsOfInterest,
} from '@balancer-labs/sor';
import { calcInGivenOut, calcOutGivenIn } from '@balancer-labs/sor/dist/bmath';
import { Pool as OldPool, Swap } from '@balancer-labs/sor/dist/types';
import { IDexHelper } from '../../dex-helper/idex-helper';

const bignumberify = (val: any) => new BigNumber(val);
const stringify = (val: any) => val.toString();

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

const poolUrls: { [key: number]: string } = {
  1: 'https://storageapi.fleek.co/balancer-bucket/balancer-exchange/pools',
  42: 'https://storageapi.fleek.co/balancer-bucket/balancer-exchange-kovan/pools',
};

const defaultfactoryAddress = '0x9424B1412450D0f8Fc2255FAf6046b98213B76Bd';
const defaultMulticallAddress = '0x514053acec7177e277b947b1ebb5c08ab4c4580e';

// This is taken from the example implementation of sor
// https://github.com/balancer-labs/balancer-sor/blob/master/test/testScripts/example-swapExactOut.ts#L18
const defaultSwapCost = new BigNumber('100000'); // A pool swap costs approx 100000 gas
// TODO: Verify what is the optimal pool count
const defaultNoPools = 4; // Maximum number of pools sor should use

export type PoolState = { [address: string]: Pool };

export function typecastReadOnlyToken(readOnlyToken: any): SORToken {
  return {
    address: readOnlyToken.address,
    balance: bignumberify(readOnlyToken.balance),
    decimals: readOnlyToken.decimals,
    denormWeight: bignumberify(readOnlyToken.denormWeight),
  };
}

export function typecastReadOnlyPool(readOnlyPool: any): Pool {
  return {
    id: readOnlyPool.id,
    swapFee: bignumberify(readOnlyPool.swapFee),
    totalWeight: bignumberify(readOnlyPool.totalWeight),
    tokens: readOnlyPool.tokens.map(typecastReadOnlyToken),
    tokensList: readOnlyPool.tokensList,
  };
}

export class BalancerPools extends StatefulEventSubscriber<PoolState> {
  addressesSubscribed?: Address[];
  handlers: {
    [event: string]: (event: any, pool: Pool, log: Log) => Pool;
  } = {};
  poolDecoder: (log: Log) => any;
  factoryDecoder: (log: Log) => any;

  isFetching?: boolean;

  constructor(
    protected parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    protected logger: Logger,

    protected factoryAddress: Address = defaultfactoryAddress,
    protected multicallAddress: Address = defaultMulticallAddress,
    protected noPools: number = defaultNoPools,
    protected swapCost: BigNumber = defaultSwapCost,
  ) {
    super(parentName, logger);

    const poolIface = new Interface(BPool);
    this.poolDecoder = (log: Log) => poolIface.parseLog(log);

    const factoryIface = new Interface(BFactory);
    this.factoryDecoder = (log: Log) => factoryIface.parseLog(log);

    // Add default handlers
    this.handlers['LOG_JOIN'] = this.handleJoinPool.bind(this);
    this.handlers['LOG_EXIT'] = this.handleExitPool.bind(this);
    this.handlers['LOG_SWAP'] = this.handleSwap.bind(this);
    // this.handlers['LOG_NEW_POOL'] = this.handleNewPool.bind(this);
  }

  protected processLog(
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): AsyncOrSync<DeepReadonly<PoolState> | null> {
    const _state: PoolState = {};
    for (let pool of Object.values(state))
      _state[pool.id] = typecastReadOnlyPool(pool);

    if (log.address == this.factoryAddress) {
      // Handle factory events
    } else {
      if (LogCallTopics.includes(log.topics[0])) {
        // TODO: handle sepcial log calls
      } else {
        try {
          const event = this.poolDecoder(log);
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

  async setup(blockNumber: number, poolState: PoolState | null = null) {
    // Use Mutex such the state generation is excludive
    if (this.isFetching) {
      throw new Error(
        `Error_${this.name}_setup could not setup while the pool is already in fetching sate.`,
      );
      return;
    } else {
      this.isFetching = true;
    }

    try {
      if (!poolState) poolState = await this.generateState(blockNumber);
      this.setState(poolState, blockNumber);
    } finally {
      this.isFetching = false;
    }
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
      this.dexHelper.provider,
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

  allocPools(from: Token, to: Token, pools: Pool[], limitPools?: string[]) {
    const allPools = pools
      .map(p => parsePoolPairData(p, from.address, to.address))
      .filter(p => !!p) as OldPool[];
    allPools.forEach(p => {
      return limitPools && limitPools.includes(`Balancer_${p.id}`);
    });
  }

  async getTopPools(
    from: Token,
    to: Token,
    side: SwapSide,
    pools: Pool[],
    minBalance: bigint,
    isStale: boolean,
    blockNumber: number,
    limitPools?: string[],
  ) {
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
          (!limitPools || limitPools.includes(`Balancer_${p.id}`)) &&
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
      this.dexHelper.provider,
      blockNumber,
    );
    return rawSelectedPools
      .map(p => parsePoolPairData(p, from.address, to.address))
      .filter(p => !!p && checkBalance(p)) as OldPool[];
  }

  async getPoolPrices(pool: OldPool, side: SwapSide, amount: bigint) {
    if (
      side === SwapSide.BUY &&
      amount * BigInt(2) > BigInt(pool.balanceOut.toFixed(0))
    ) {
      return MAX_UINT_BIGINT;
    }
    const _amount = new BigNumberSor(amount.toString());
    const res =
      side === SwapSide.SELL
        ? calcOutGivenIn(
            pool.balanceIn,
            pool.weightIn,
            pool.balanceOut,
            pool.weightOut,
            _amount,
            pool.swapFee,
          )
        : calcInGivenOut(
            pool.balanceIn,
            pool.weightIn,
            pool.balanceOut,
            pool.weightOut,
            _amount,
            pool.swapFee,
          );
    return BigInt(res.toFixed(0));
  }

  async getSwapData(
    from: Token,
    to: Token,
    side: SwapSide,
    blockNumber: number,
    pools: Pool[],
  ) {
    // The code refers the sor example provided here
    // https://github.com/balancer-labs/balancer-sor/blob/master/test/testScripts/example-swapExactIn.ts

    /*const gasPrice = new BigNumber(GasTracker.gasPrice.fast);
    const tokenIn = from.address.toLowerCase();
    const tokenOut = to.address.toLowerCase();*/
    const swapType = side == SwapSide.SELL ? 'swapExactIn' : 'swapExactOut';

    // This converts the new pools into the old pool structure
    let balancers = pools
      .map(p => parsePoolPairData(p, from.address, to.address))
      .filter(p => !!p)
      .sort(
        (p1, p2) =>
          parseFloat(
            p2!.balanceOut.times(1e18).idiv(p2!.weightOut).toFixed(0),
          ) -
          parseFloat(p1!.balanceOut.times(1e18).idiv(p1!.weightOut).toFixed(0)),
      )
      .slice(0, 10) as OldPool[];
    if (!balancers.length) return null;
    balancers = processBalancers(balancers, swapType);

    // This calculates the cost in output token (output token is tokenOut for swapExactIn and
    // tokenIn for a swapExactOut) for each additional pool added to the final SOR swap result.
    // This is used as an input to SOR to allow it to make gas efficient recommendations, i.e.
    // if it costs 5 DAI to add another pool to the SOR solution and that only generates 1 more DAI,
    // then SOR should not add that pool (if gas costs were zero that pool would be added)
    /*const outputTokenAddr = side == SwapSide.SELL ? to : from;
    const costOutputToken = await getCostOutputToken(
      outputTokenAddr,
      gasPrice,
      this.swapCost,
    );*/

    const eps = processEpsOfInterest(balancers, swapType);

    return {
      balancers,
      eps,
      swapType,
      noPools: this.noPools,
      //costOutputToken,
    };
  }

  // getPrice(
  //   amount: BigNumber,
  //   swapData: { [key: string]: any },
  // ): [Swap[], BigNumber] {
  //   const sorSwaps = smartOrderRouterEpsOfInterest(
  //     swapData.balancers,
  //     swapData.swapType,
  //     BigNumberSor(amount.toE(0)),
  //     swapData.noPools,
  //     new BigNumberSor(0),
  //     swapData.eps,
  //   );

  //   const swaps = (
  //     swapData.swapType === 'swapExactIn'
  //       ? formatSwapsExactAmountIn(sorSwaps, MAX_UINT, new BigNumber(0))
  //       : formatSwapsExactAmountOut(
  //           sorSwaps,
  //           MAX_UINT,
  //           new BigNumber(2).exponentiatedBy(256).minus(1),
  //         )
  //   ).map(swap => ({
  //     ...swap,
  //     tokenInParam: new BigNumber(swap.tokenInParam).toFixed(0),
  //     tokenOutParam: new BigNumber(swap.tokenOutParam).toFixed(0),
  //     maxPrice: new BigNumber(swap.maxPrice).toFixed(0),
  //   }));

  //   const rate =
  //     swapData.swapType === 'swapExactIn'
  //       ? calcTotalOutput(swaps, swapData.balancers)
  //       : calcTotalInput(swaps, swapData.balancers);
  //   return [swaps, rate];
  // }

  handleJoinPool(event: any, pool: Pool, log: Log): Pool {
    const tokenIn = event.args.tokenIn.toLowerCase();
    const tokenAmountIn = event.args.tokenAmountIn.toString();
    pool.tokens = pool.tokens.map(token => {
      if (token.address.toLowerCase() === tokenIn)
        token.balance = token.balance.plus(tokenAmountIn);
      return token;
    });
    return pool;
  }

  handleExitPool(event: any, pool: Pool, log: Log): Pool {
    const tokenOut = event.args.tokenOut.toLowerCase();
    const tokenAmountOut = event.args.tokenAmountOut.toString();
    pool.tokens = pool.tokens.map(token => {
      if (token.address.toLowerCase() === tokenOut)
        token.balance = token.balance.minus(tokenAmountOut);
      return token;
    });
    return pool;
  }

  handleSwap(event: any, pool: Pool, log: Log): Pool {
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

  // handleNewPool(
  //   event: any,
  //   log: Log,
  // ): Pool {
  //   // TODO: Only add a pool if the liquidity is atleast as much as the lowest liquid pool
  //   const newPoolAddress: Address = event.args.address;
  //   // let newPool: BalancerPool = new BalancerPool(
  //   //   this.name,
  //   //   this.web3Provider,
  //   //   this.network,
  //   //   newPoolAddress,
  //   // );
  //   // const statePool = await newPool.generateState(log.blockNumber);
  //   // let tokenTrackingCnt = 0;
  //   // TODO: Correct the logic to check token pairs
  //   // Object.keys(statePool.records).forEach((address: Address) => {
  //   //   if (address in this.trackingTokens && this.trackingTokens[address])
  //   //     tokenTrackingCnt += 1;
  //   // });
  //   // if (tokenTrackingCnt > 1) this.pools[newPoolAddress] = newPool;
  //   return pool;
  // }
}
