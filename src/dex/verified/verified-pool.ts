import { Interface } from '@ethersproject/abi';
import { DeepReadonly, assert } from 'ts-essentials';
import { Address, Log, Logger, Token } from '../../types';
import { bigIntify, catchParseLogError } from '../../utils';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  PoolState,
  callData,
  SubgraphPoolBase,
  TokenState,
  VerifiedPoolTypes,
  PoolStateMap,
  PoolPairData,
  OrdersState,
} from './types';
import VAULTABI from '../../abi/verified/vault.json';
import PRIMARYISSUE from '../../abi/verified/PrimaryIssuePool.json';
import SECONDARYISSUE from '../../abi/verified/SecondaryIssuePool.json';
import _, { keyBy } from 'lodash';
import { SUBGRAPH_TIMEOUT, SwapSide } from '../../constants';
import { decodeThrowError, poolGetMainTokens } from './utils';
import { MathSol } from '../balancer-v2/balancer-v2-math';
import { BigNumber, formatFixed } from '@ethersproject/bignumber';
import { BigNumber as BigN } from 'bignumber.js';

const MAX_POOL_CNT = 1000; // Taken from SOR
const POOL_CACHE_TTL = 60 * 60; // 1 hr

const fetchAllPools = `query ($count: Int)    {
  pools: pools(
    first: $count
    orderDirection: desc
    where: {
    swapEnabled: true, 
    poolType_in: ["PrimaryIssue", "SecondaryIssue"]
    }
  ) {
    id
    address
    poolType
    tokens {
      address
      decimals
    }
    security
    currency
    orders {
      id
      creator
      tokenIn {
       id
      }
      tokenOut {
       id
      }
      amountOffered
      priceOffered
      timestamp
      orderReference 
    }
    secondaryTrades{
      id
      party {
        id
      }
      counterparty {
        id
      }
      orderType
      price
      currency {
        id
      }
      amount
      executionDate
      orderReference
    }
  }
}`;

function typecastReadOnlyPoolState(pool: DeepReadonly<PoolState>): PoolState {
  return _.cloneDeep(pool) as PoolState;
}

///Todo: Code cleanup, functions breakdown documentation and tests
export class VerifiedEventPool extends StatefulEventSubscriber<PoolStateMap> {
  ///1. Declare useful Object variables
  handlers: {
    [event: string]: (event: any, pool: PoolState, log: Log) => PoolState;
  } = {};

  logDecoder: (log: Log) => any;

  public addressesSubscribed: string[];
  public vaultInterface: Interface;
  public primaryIssueInterface: Interface;
  public secondaryIssueInterface: Interface;
  eventSupportedPoolTypes: VerifiedPoolTypes[] = [
    VerifiedPoolTypes.PrimaryIssuePool,
    VerifiedPoolTypes.SecondaryIssuePool,
  ];
  public allPools: SubgraphPoolBase[] = [];

  ///2. initialize each variables
  constructor(
    readonly parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    public vaultAddress: Address,
    protected subgraphURL: string,
    logger: Logger,
  ) {
    super(parentName, vaultAddress, dexHelper, logger);
    this.vaultInterface = new Interface(VAULTABI);
    this.primaryIssueInterface = new Interface(PRIMARYISSUE.abi);
    this.secondaryIssueInterface = new Interface(SECONDARYISSUE.abi);
    this.logDecoder = (log: Log) => this.vaultInterface.parseLog(log);
    this.addressesSubscribed = [vaultAddress];
    // Add handlers
    this.handlers['Swap'] = this.handleSwap.bind(this);
    this.handlers['PoolBalanceChanged'] =
      this.handlePoolBalanceChanged.bind(this);
  }

  ///3.handle all state retaled functions
  /**
   * The function is called every time any of the subscribed
   * addresses release log. The function accepts the current
   * state, updates the state according to the log, and returns
   * the updated state.
   * @param state - Current state of event subscriber
   * @param log - Log released by one of the subscribed addresses
   * @returns Updates state of the event subscriber after the log
   */

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

  async fetchAllSubgraphPools(): Promise<SubgraphPoolBase[]> {
    //check memory for saved pools
    const cacheKey = 'VerifiedBalancerSubgraphPools2';
    const cachedPools = await this.dexHelper.cache.get(
      this.parentName,
      this.network,
      cacheKey,
    );
    //use pools from memory if they exist
    if (cachedPools) {
      const allPools = JSON.parse(cachedPools);
      this.logger.info(
        `Got ${allPools.length} ${this.parentName}_${this.network} pools from cache`,
      );
      return allPools;
    }
    //fetch pools from subgraph and filter if memory pools do exist
    this.logger.info(
      `Fetching ${this.parentName}_${this.network} Pools from subgraph`,
    );
    const poolsCount = {
      count: MAX_POOL_CNT,
    };
    const { data } = await this.dexHelper.httpRequest.post(
      this.subgraphURL,
      { query: fetchAllPools, poolsCount },
      SUBGRAPH_TIMEOUT,
    );

    if (!(data && data.pools))
      throw new Error('Unable to fetch pools from Verified-Balancer subgraph');
    const poolsMap = keyBy(data.pools, 'address');
    const allPools: SubgraphPoolBase[] = data.pools.map(
      (pool: Omit<SubgraphPoolBase, 'mainTokens'>) => ({
        ...pool,
        mainTokens: poolGetMainTokens(pool, poolsMap),
      }),
    );

    //save to memory
    this.dexHelper.cache.setex(
      this.parentName,
      this.network,
      cacheKey,
      POOL_CACHE_TTL,
      JSON.stringify(allPools),
    );

    this.logger.info(
      `Got ${allPools.length} ${this.parentName}_${this.network} pools from subgraph`,
    );
    return allPools;
  }

  /*
    Helper function to construct onchain multicall data for Both Primary and SecondaryIssue Pool.
  */
  getOnChainCalls(pool: SubgraphPoolBase): callData[] {
    const poolCallData: callData[] = [
      {
        target: this.vaultAddress,
        callData: this.vaultInterface.encodeFunctionData('getPoolTokens', [
          pool.id,
        ]),
      },
    ];
    if (pool.poolType === VerifiedPoolTypes.PrimaryIssuePool) {
      poolCallData.push({
        target: pool.address,
        callData:
          this.primaryIssueInterface.encodeFunctionData('getMinimumPrice'),
      });
      poolCallData.push({
        target: pool.address,
        callData: this.primaryIssueInterface.encodeFunctionData(
          'getMinimumOrderSize',
        ),
      });
    }
    if (pool.poolType === VerifiedPoolTypes.SecondaryIssuePool) {
      poolCallData.push({
        target: pool.address,
        callData:
          this.secondaryIssueInterface.encodeFunctionData('getMinOrderSize'),
      });
    }

    return poolCallData;
  }

  /*
    Helper function to decodes multicall data for both Primary and SecondaryIssue pools.
    data must contain returnData
    startIndex is where to start in returnData. Allows this decode function to be called along with other pool types.
    */
  decodeOnChainCalls(
    pool: SubgraphPoolBase,
    data: { success: boolean; returnData: any }[],
    startIndex: number,
  ): [{ [address: string]: PoolState }, number] {
    const pools = {} as { [address: string]: PoolState };
    let minimumOrderSize: any;
    let minimumPrice: any;

    const poolTokens = decodeThrowError(
      this.vaultInterface,
      'getPoolTokens',
      data[startIndex++],
      pool.address,
    );

    if (pool.poolType === VerifiedPoolTypes.PrimaryIssuePool) {
      minimumOrderSize = decodeThrowError(
        this.primaryIssueInterface,
        'getMinimumOrderSize',
        data[startIndex++],
        pool.address,
      )[0];

      minimumPrice = decodeThrowError(
        this.primaryIssueInterface,
        'getMinimumPrice',
        data[startIndex++],
        pool.address,
      )[0];
    }

    if (pool.poolType === VerifiedPoolTypes.SecondaryIssuePool) {
      minimumOrderSize = decodeThrowError(
        this.secondaryIssueInterface,
        'getMinOrderSize',
        data[startIndex++],
        pool.address,
      )[0];
    }

    const poolState: PoolState = {
      swapFee: BigInt('0'),
      tokens: poolTokens.tokens.reduce(
        (ptAcc: { [address: string]: TokenState }, pt: string, j: number) => {
          const tokenState: TokenState = {
            balance: BigInt(poolTokens.balances[j].toString()),
          };
          ptAcc[pt.toLowerCase()] = tokenState;
          return ptAcc;
        },
        {},
      ),
      orderedTokens: poolTokens.tokens,
      minimumOrderSize,
      minimumPrice,
    };

    pools[pool.address] = poolState;

    return [pools, startIndex];
  }

  async getOnChainState(
    subgraphPoolBase: SubgraphPoolBase[],
    blockNumber: number,
  ): Promise<PoolStateMap> {
    const multiCallData = subgraphPoolBase
      .map(pool => {
        if (!this.isSupportedPool(pool.poolType)) return [];

        return this.getOnChainCalls(pool);
      })
      .flat();

    // 500 is an arbitrary number chosen based on the blockGasLimit
    const slicedMultiCallData = _.chunk(multiCallData, 500);

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
        if (!this.isSupportedPool(pool.poolType)) return acc;

        const [decoded, newIndex] = this.decodeOnChainCalls(
          pool,
          returnData,
          i,
        );
        i = newIndex;
        acc = { ...acc, ...decoded };
        return acc;
      },
      {},
    );

    return onChainStateMap;
  }
  /**
   * The function generates state using on-chain calls. This
   * function is called to regenerate state if the event based
   * system fails to fetch events and the local state is no
   * more correct.
   * @param blockNumber - Blocknumber for which the state should
   * should be generated
   * @returns state of the event subscriber at blocknumber
   */
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

  /*
    Helper function to parse pool data into params for onSell and onBuy function.
  */
  parsePoolPairData(
    pool: SubgraphPoolBase,
    poolState: PoolState,
    tokenIn: string,
    tokenOut: string,
  ): PoolPairData {
    let indexIn = 0;
    let indexOut = 0;
    let bptIndex = 0;
    let balances: bigint[] = [];
    let decimals: number[] = [];
    let scalingFactors: bigint[] = [];
    const tokens = poolState.orderedTokens.map((tokenAddress, i) => {
      const t = pool.tokensMap[tokenAddress.toLowerCase()];
      if (t.address.toLowerCase() === tokenIn.toLowerCase()) indexIn = i;
      if (t.address.toLowerCase() === tokenOut.toLowerCase()) indexOut = i;
      if (t.address.toLowerCase() === pool.address.toLowerCase()) bptIndex = i;
      balances.push(poolState.tokens[t.address.toLowerCase()].balance);
      const _decimal = pool.tokens[i].decimals;
      decimals.push(_decimal);
      scalingFactors.push(BigInt(10 ** (18 - _decimal)));
      return t.address;
    });
    const orders = pool.orders;
    const secondaryTrades = pool.secondaryTrades;
    const poolPairData: PoolPairData = {
      tokens,
      balances,
      decimals,
      indexIn,
      indexOut,
      bptIndex,
      swapFee: poolState.swapFee,
      minOrderSize: poolState.minimumOrderSize,
      minPrice: poolState.minimumPrice,
      scalingFactors,
      orders,
      secondaryTrades,
    };
    return poolPairData;
  }

  //gets amount of tokenOut in primaryIssue pool(used when selling) according to calculation from SOR Repo
  getPrimaryTokenOut(
    poolPairData: PoolPairData,
    amount: bigint,
    isCurrencyIn: boolean,
  ): bigint {
    try {
      if (amount === 0n) return 0n;
      const tokenInBalance = poolPairData.balances[poolPairData.indexIn];
      const tokenOutBalance = poolPairData.balances[poolPairData.indexOut];
      let tokenOut: bigint;
      if (isCurrencyIn) {
        //Swap Currency IN
        const scalingFactor = poolPairData.scalingFactors[poolPairData.indexIn];
        const currencyAmount = MathSol.mul(amount, scalingFactor);
        const numerator = MathSol.divDownFixed(
          currencyAmount,
          poolPairData.minPrice!,
        );
        const denominator = MathSol.divDownFixed(
          MathSol.add(tokenInBalance, currencyAmount),
          tokenInBalance,
        );
        tokenOut = MathSol.divDownFixed(numerator, denominator);
        if (tokenOut < poolPairData.minOrderSize) {
          return 0n;
        }
      } else {
        const scalingFactor =
          poolPairData.scalingFactors[poolPairData.indexOut];
        //Swap Security IN
        if (tokenInBalance < 0) return 0n;
        if (amount < poolPairData.minOrderSize) return 0n;
        const numerator = MathSol.divDownFixed(
          MathSol.add(tokenInBalance, amount),
          tokenInBalance,
        );
        const denominator = MathSol.mulDownFixed(
          amount,
          poolPairData.minPrice!,
        );
        const _tokenOut = MathSol.mulDownFixed(numerator, denominator);

        tokenOut = MathSol.divDown(_tokenOut, scalingFactor);
      }
      const scaleTokenOut = formatFixed(
        BigNumber.from(Math.trunc(Number(tokenOut.toString())).toString()),
        poolPairData.decimals[poolPairData.indexOut],
      );
      if (tokenOutBalance < tokenOut) return 0n;
      return BigInt(scaleTokenOut);
    } catch (err: any) {
      this.logger.error(
        `Error While Getting Amount Out From Primary Pool: ${err.message}`,
      );
      return 0n;
    }
  }
  //gets amount of tokenIn in primaryIssue pool(used when buying) according to calculation from SOR Repo
  getPrimaryTokenIn(
    poolPairData: PoolPairData,
    amount: bigint,
    isCurrencyIn: boolean,
  ): bigint {
    try {
      if (amount == 0n) return 0n;

      const tokenInBalance = poolPairData.balances[poolPairData.indexIn];
      const tokenOutBalance = poolPairData.balances[poolPairData.indexOut];
      let tokenIn: bigint;
      if (!isCurrencyIn) {
        //Swap Currency OUT
        const scalingFactor =
          poolPairData.scalingFactors[poolPairData.indexOut];
        if (tokenInBalance < 0) return 0n;
        const currencyAmount = MathSol.mul(amount, scalingFactor);
        if (currencyAmount >= tokenOutBalance) return 0n;

        const numerator = MathSol.divDownFixed(amount, poolPairData.minPrice!);
        const denominator = MathSol.divDownFixed(
          tokenOutBalance,
          MathSol.sub(tokenOutBalance, currencyAmount),
        );
        tokenIn = MathSol.divDownFixed(numerator, denominator);

        if (tokenIn < poolPairData.minOrderSize) return 0n;
      } else {
        //Swap Security OUT
        const scalingFactor = poolPairData.scalingFactors[poolPairData.indexIn];
        if (amount >= tokenOutBalance) return 0n;
        if (amount < poolPairData.minOrderSize) return 0n;
        const numerator = MathSol.divDownFixed(
          tokenOutBalance,
          MathSol.sub(tokenOutBalance, amount),
        );
        const denominator = MathSol.mulDownFixed(
          amount,
          BigInt(Number(poolPairData.minPrice!)),
        );

        tokenIn = MathSol.mulDownFixed(numerator, denominator);
        tokenIn = MathSol.divDown(tokenIn, scalingFactor);
      }

      const scaleTokenIn = formatFixed(
        BigNumber.from(Math.trunc(Number(tokenIn.toString())).toString()),
        poolPairData.decimals[poolPairData.indexIn],
      );

      return BigInt(scaleTokenIn);
    } catch (err: any) {
      this.logger.error(
        `Error While Getting Amount In From Primary Pool: ${err.message}`,
      );
      return 0n;
    }
  }

  //gets amount of token for Secondary issue pool(used when buying and selling) according to calculation from SOR Repo
  _getSecondaryTokenAmount(
    amount: bigint,
    ordersDataScaled: OrdersState[],
    scalingFactor: bigint,
    orderType: string,
  ): bigint {
    let returnAmount = BigInt(0);
    for (let i = 0; i < ordersDataScaled.length; i++) {
      const amountOffered = BigInt(ordersDataScaled[i].amountOffered);
      const priceOffered = BigInt(ordersDataScaled[i].priceOffered);
      const checkValue =
        orderType === 'Sell'
          ? MathSol.divDownFixed(amountOffered, priceOffered)
          : MathSol.mulDownFixed(amountOffered, priceOffered);

      if (checkValue <= Number(amount)) {
        returnAmount = MathSol.add(returnAmount, amountOffered);
      } else {
        returnAmount = MathSol.add(
          returnAmount,
          orderType === 'Sell'
            ? MathSol.mulDownFixed(BigInt(Number(amount)), priceOffered)
            : MathSol.divDownFixed(BigInt(Number(amount)), priceOffered),
        );
      }
      amount = BigInt(Number(amount) - Number(checkValue));
      if (Number(amount) < 0) break;
    }

    returnAmount =
      orderType === 'Sell'
        ? MathSol.divDown(returnAmount, BigInt(Number(scalingFactor)))
        : returnAmount;

    return BigInt(Number(returnAmount));
  }
  //gets amount of tokenOut in Secondary Issue pool(used when selling) according to calculation from SOR Repo
  getSecondaryTokenOut(
    poolPairData: PoolPairData,
    amount: bigint,
    creator: string,
    isCurrencyIn: boolean,
  ): bigint {
    try {
      if (amount == 0n) return 0n;
      let security: string;
      let scalingFactor: bigint;
      if (isCurrencyIn) {
        security = poolPairData.tokens[poolPairData.indexOut];
        scalingFactor = poolPairData.scalingFactors[poolPairData.indexIn];
      }
      if (!isCurrencyIn) {
        security = poolPairData.tokens[poolPairData.indexIn];
        scalingFactor = poolPairData.scalingFactors[poolPairData.indexOut];
      }
      let buyOrders = poolPairData
        .orders!.filter(
          order =>
            order.tokenIn.id.toLowerCase() !== security.toLowerCase() &&
            order.creator.toLowerCase() !== creator.toLowerCase(),
        )
        .sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

      // filtering of edited & cancelled order from orderBook
      let openOrders: OrdersState[] = Object.values(
        buyOrders.reduce((acc: any, cur) => {
          if (!acc[cur.orderReference]) {
            // If this is the first time we've seen this orderReference, add it to the accumulator
            acc[cur.orderReference] = cur;
          }
          return acc;
        }, {}),
      );
      openOrders = openOrders.filter(order => order.priceOffered !== 0);
      if (poolPairData.secondaryTrades?.length) {
        buyOrders = openOrders
          .map(order => {
            // filtering of already matched orders
            const matchedTrade = poolPairData.secondaryTrades?.find(
              trade =>
                trade.orderReference?.toLowerCase() ===
                order.orderReference?.toLowerCase(),
            );
            if (matchedTrade) {
              const price =
                order.tokenIn.id.toLowerCase() === security.toLowerCase()
                  ? (1 / matchedTrade.price) * 10 ** 18
                  : matchedTrade.price / 10 ** 18;
              const amount = matchedTrade.amount * price;
              return {
                ...order,
                amountOffered: order.amountOffered - amount,
              };
            }
            return order;
          })
          .filter(element => element && element.amountOffered !== 0);
      }
      buyOrders = buyOrders.sort((a, b) => b.priceOffered - a.priceOffered);

      const orderBookdepth = BigInt(
        buyOrders
          .map(
            order =>
              (order.amountOffered / order.priceOffered) *
              Number(BigNumber.from('1000000000000000000')),
          )
          .reduce((partialSum, a) => Number(BigN(partialSum).plus(BigN(a))), 0),
      );
      if (Number(amount) > Number(orderBookdepth)) return 0n;

      const tokensOut = this._getSecondaryTokenAmount(
        amount,
        buyOrders,
        scalingFactor!,
        'Sell',
      );

      const scaleTokensOut = formatFixed(
        BigNumber.from(Math.trunc(Number(tokensOut.toString())).toString()),
        poolPairData.decimals[poolPairData.indexOut],
      );
      return BigInt(scaleTokensOut);
    } catch (err: any) {
      this.logger.error(
        `Error While Getting Amount Out From secondary Pool: ${err.message}`,
      );
      return 0n;
    }
  }
  //Todo: handle getSecondaryTokenIn

  // Swap Hooks
  onBuy(
    amounts: bigint[],
    poolPairData: PoolPairData,
    isCurrencyIn: boolean,
    poolType: VerifiedPoolTypes,
  ): bigint[] {
    if (poolType === VerifiedPoolTypes.PrimaryIssuePool) {
      return amounts.map(amount =>
        this.getPrimaryTokenIn(poolPairData, amount, isCurrencyIn),
      );
    } else if (poolType === VerifiedPoolTypes.SecondaryIssuePool) {
      //Todo: Complete me
      return [0n];
    } else {
      this.logger.error('OnBuy Error: Invalid Pool type');
      return [0n];
    }
  }
  //Todo: Figure out who creator is while testing tomorrow;
  onSell(
    amounts: bigint[],
    poolPairData: PoolPairData,
    isCurrencyIn: boolean,
    creator: string | undefined,
    poolType: VerifiedPoolTypes,
  ): bigint[] {
    if (poolType === VerifiedPoolTypes.PrimaryIssuePool) {
      return amounts.map(amount =>
        this.getPrimaryTokenOut(poolPairData, amount, isCurrencyIn),
      );
    } else if (poolType === VerifiedPoolTypes.SecondaryIssuePool) {
      return amounts.map(amount =>
        this.getSecondaryTokenOut(poolPairData, amount, creator!, isCurrencyIn),
      );
    } else {
      this.logger.error('OnSell Error: Invalid Pool type');
      return [0n];
    }
  }

  /*
  use 99% of the balance(Verify if decimal is not needed to calculate)
  */
  getSwapMaxAmount(poolPairData: PoolPairData, side: SwapSide): bigint {
    return (
      ((side === SwapSide.SELL
        ? poolPairData.balances[poolPairData.indexIn]
        : poolPairData.balances[poolPairData.indexOut]) *
        99n) /
      100n
    );
  }

  getPricesPool(
    from: Token,
    to: Token,
    subgraphPool: SubgraphPoolBase,
    poolState: PoolState,
    amounts: bigint[],
    unitVolume: bigint,
    side: SwapSide,
  ): { unit: bigint; prices: bigint[] } | null {
    if (!this.isSupportedPool(subgraphPool.poolType)) {
      this.logger.error(`Unsupported Pool Type: ${subgraphPool.poolType}`);
      return null;
    }
    const amountWithoutZero = amounts.slice(1);
    const poolPairData = this.parsePoolPairData(
      subgraphPool,
      poolState,
      from.address,
      to.address,
    );

    const swapMaxAmount = this.getSwapMaxAmount(poolPairData, side);

    const checkedAmounts: bigint[] = new Array(amountWithoutZero.length).fill(
      0n,
    );

    const checkedUnitVolume = this.getNewAmount(swapMaxAmount, unitVolume);

    let nonZeroAmountIndex = 0;
    for (const [i, amountIn] of amountWithoutZero.entries()) {
      const checkedOutput = this.getNewAmount(swapMaxAmount, amountIn);
      if (checkedOutput === 0n) {
        // Stop earlier because other values are bigger and for sure wont' be tradable
        break;
      }
      nonZeroAmountIndex = i + 1;
      checkedAmounts[i] = checkedOutput;
    }

    if (nonZeroAmountIndex === 0) {
      return null;
    }

    const isCurrencyIn = from.address === subgraphPool.currency;
    //Todo: Figure out creator
    let creator;
    const unitResult =
      checkedUnitVolume === 0n
        ? 0n
        : side === SwapSide.SELL
        ? this.onSell(
            [checkedUnitVolume],
            poolPairData,
            isCurrencyIn,
            creator,
            subgraphPool.poolType,
          )[0]
        : this.onBuy(
            [checkedUnitVolume],
            poolPairData,
            isCurrencyIn,
            subgraphPool.poolType,
          )[0];

    const prices: bigint[] = new Array(amounts.length).fill(0n);

    const outputs =
      side === SwapSide.SELL
        ? this.onSell(
            amountWithoutZero.slice(0, nonZeroAmountIndex),
            poolPairData,
            isCurrencyIn,
            creator,
            subgraphPool.poolType,
          )
        : this.onBuy(
            amountWithoutZero.slice(0, nonZeroAmountIndex),
            poolPairData,
            isCurrencyIn,
            subgraphPool.poolType,
          );

    assert(
      outputs.length <= prices.length,
      `Wrong length logic: outputs.length (${outputs.length}) <= prices.length (${prices.length})`,
    );

    for (const [i, output] of outputs.entries()) {
      // Outputs shifted right to one to keep first entry as 0
      prices[i + 1] = output;
    }

    return { unit: unitResult, prices };
  }

  //4 handle handlers function and others
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

  //TODO: Move to Utils
  public isSupportedPool(poolType: string): boolean {
    return (
      poolType == VerifiedPoolTypes.PrimaryIssuePool ||
      poolType == VerifiedPoolTypes.SecondaryIssuePool
    );
  }

  getNewAmount(max: bigint, num: bigint): bigint {
    return max >= num ? num : 0n;
  }
}
