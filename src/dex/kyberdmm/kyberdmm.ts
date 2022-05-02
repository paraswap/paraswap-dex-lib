import { Interface, AbiCoder, JsonFragment } from '@ethersproject/abi';
import { SimpleExchange } from '../simple-exchange';
import { IDex } from '../../dex/idex';
import _ from 'lodash';
import { Network, SwapSide } from '../../constants';
import { PRECISION } from './fee-formula';
import {
  getTradeInfo,
  KyberDmmPair,
  KyberDmmPool,
  KyberDmmPoolInitData,
  KyberDmmPoolOrderedParams,
  KyberDmmPoolState,
} from './pool';
import {
  AdapterExchangeParam,
  ExchangePrices,
  PoolLiquidity,
  SimpleExchangeParam,
  Token,
} from '../../types';
import {
  KyberDmmData,
  KyberDMMFunctions,
  KyberDmmParam,
  TradeInfo,
} from './types';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { Adapters, KyberDmmConfig } from './config';
import { Logger } from 'log4js';
import { Contract } from 'web3-eth-contract';

import kyberDmmFactoryABI from '../../abi/kyberdmm/kyber-dmm-factory.abi.json';
import KyberDmmExchangeRouterABI from '../../abi/kyberdmm/kyber-dmm-exchange-router.abi.json';
import { getBigIntPow, getDexKeysWithNetwork, wrapETH } from '../../utils';
import { SubscriberInfo } from '../../dex-helper';

const subgraphTimeout = 10 * 1000;

export class KyberDmm
  extends SimpleExchange
  implements IDex<KyberDmmData, KyberDmmPoolInitData, KyberDmmPoolState>
{
  pairs: { [key: string]: KyberDmmPair } = {};
  needWrapNative = true;
  factory: Contract;
  logger: Logger;

  exchangeRouterInterface: Interface;

  readonly hasConstantPriceLargeAmounts = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(KyberDmmConfig);

  constructor(
    protected network: Network,
    protected dexKey: string,
    protected dexHelper: IDexHelper,
    protected config = KyberDmmConfig[dexKey][network],
    protected adapters = Adapters[network],
  ) {
    super(dexHelper.augustusAddress, dexHelper.provider);

    this.logger = dexHelper.getLogger(dexKey);

    this.factory = new this.dexHelper.web3Provider.eth.Contract(
      kyberDmmFactoryABI as any,
      config.factoryAddress,
    );

    this.exchangeRouterInterface = new Interface(KyberDmmExchangeRouterABI);
  }

  async getPoolIdentifiers(
    from: Token,
    to: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    from = wrapETH(from, this.network);
    to = wrapETH(to, this.network);

    const pair = await this.findPair(from, to);

    if (pair && pair.exchanges.length > 0) {
      const z = pair.exchanges.map(poolAddress => {
        return `${this.dexKey}_${poolAddress.toLowerCase()}`;
      });

      return z;
    } else return [];
  }

  getEventSubscriber(poolInitData: KyberDmmPoolInitData): KyberDmmPool {
    const pool = new KyberDmmPool(
      poolInitData.identifier,
      this.dexHelper,
      poolInitData.poolAddress,
      poolInitData.token0,
      poolInitData.token1,
      this.logger,
    );

    return pool;
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    if (side === SwapSide.BUY) return null;
    return this.adapters;
  }

  async getTopPoolsForToken(
    tokenAddress: string,
    count: number,
  ): Promise<PoolLiquidity[]> {
    if (!this.config.subgraphURL) return [];

    const query = `
      query ($token: Bytes!, $count: Int) {
          pools0: pairs(first: $count, orderBy: reserveUSD, orderDirection: desc, where: {token0: $token}) {
              id
              reserveUSD
              token0{
                  id
                  decimals
              }
              token1{
                  id
                  decimals
              }
          }
          pools1: pairs(first: $count, orderBy: reserveUSD, orderDirection: desc, where: {token1: $token}) {
              id
              reserveUSD
              token1{
                  id
                  decimals
              }
              token0{
                  id
                  decimals
              }
          }
      }
    `;

    const { data } = await this.dexHelper.httpRequest.post(
      this.config.subgraphURL,
      {
        query,
        variables: { token: tokenAddress.toLowerCase(), count },
      },
      subgraphTimeout,
    );

    if (!(data && data.pools0 && data.pools1))
      throw new Error(
        `Error_${this.dexKey}_Subgraph: couldn't fetch the pools from the subgraph`,
      );

    const pools = _.map(_.concat(data.pools0, data.pools1), pool => ({
      exchange: this.dexKey,
      address: pool.id.toLowerCase(),
      connectorTokens: [pool.token0, pool.token1].reduce(
        (acc, { decimals, id }) => {
          if (id.toLowerCase() != tokenAddress.toLowerCase())
            acc.push({
              decimals: parseInt(decimals),
              address: id.toLowerCase(),
            });
          return acc;
        },
        [],
      ),
      liquidityUSD: parseFloat(pool.reserveUSD),
    }));

    return _.slice(_.sortBy(pools, [pool => -1 * pool.liquidityUSD]), 0, count);
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: KyberDmmData,
    side: SwapSide,
  ): AdapterExchangeParam {
    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          poolPath: 'address[]',
          path: 'address[]',
        },
      },
      { poolPath: data.pools.map(p => p.address), path: data.path },
    );
    return {
      targetExchange: data.router,
      payload,
      networkFee: '0',
    };
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: KyberDmmData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const isSell = side === SwapSide.SELL;
    const swapFunctionParams: KyberDmmParam = [
      isSell ? srcAmount : destAmount,
      isSell ? destAmount : srcAmount,
      data.pools.map(p => p.address),
      data.path,
      this.augustusAddress,
      Number.MAX_SAFE_INTEGER.toString(),
    ];
    const swapData = this.exchangeRouterInterface.encodeFunctionData(
      isSell
        ? KyberDMMFunctions.swapExactTokensForTokens
        : KyberDMMFunctions.swapTokensForExactTokens,
      swapFunctionParams,
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      data.router,
    );
  }

  private addPool(pair: KyberDmmPair, blockNumber: number) {
    for (const poolAddress of pair.exchanges) {
      const identifier =
        `${this.dexHelper.network}_${this.dexKey}_${poolAddress}`.toLowerCase();
      const poolInitData: KyberDmmPoolInitData = {
        identifier,
        token0: pair.token0,
        token1: pair.token1,
        poolAddress,
        blockNumber,
      };

      const subscriberInfo: SubscriberInfo<KyberDmmPoolInitData> = {
        dexKey: this.dexKey,
        identifier,
        initParams: poolInitData,
        addressSubscribed: poolAddress,
      };
      const pool = this.dexHelper.blockManager.subscribeToLogs(
        subscriberInfo,
        false,
      );
      pair.pools[poolAddress] = pool as KyberDmmPool;
    }
  }

  async getPricesVolume(
    from: Token,
    to: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<ExchangePrices<KyberDmmData> | null> {
    try {
      if (!this.factory) {
        return null;
      }

      from = wrapETH(from, this.network);
      to = wrapETH(to, this.network);

      if (from.address.toLowerCase() === to.address.toLowerCase()) {
        return null;
      }

      await this.catchUpPair(from, to, blockNumber);
      const pairParam = await this.getPairOrderedParams(from, to, blockNumber);

      if (!pairParam) return null;

      pairParam.poolData = pairParam.poolData.filter(pool => {
        const poolIdentifier = `${
          this.dexKey
        }_${pool.poolAddress.toLowerCase()}`;
        return !limitPools || limitPools.includes(poolIdentifier);
      });

      if (!pairParam.poolData.length) return null;

      return Promise.all(
        pairParam.poolData.map(pool => {
          return this.getPoolPrice(
            from,
            to,
            side,
            amounts,
            pool,
            pairParam.direction,
            `${this.dexKey}_${pool.poolAddress.toLowerCase()}`,
            blockNumber,
          );
        }),
      );
    } catch (e) {
      if (blockNumber === 0)
        this.logger.error(
          `${this.dexKey}_getPricesVolume: Aurelius block manager not yet instantiated`,
        );
      this.logger.error(`${this.dexKey}_getPrices`, e);
      return null;
    }
  }

  private async getPoolPrice(
    from: Token,
    to: Token,
    side: SwapSide,
    amounts: bigint[],
    pool: { poolAddress: string; state: KyberDmmPoolState },
    direction: boolean,
    poolIdentifier: string,
    blockNumber: number,
  ): Promise<any> {
    // const [tokenA] = [
    //   from.address.toLowerCase(),
    //   to.address.toLowerCase(),
    // ].sort((a, b) => (a > b ? 1 : -1));

    const unitAmount = getBigIntPow(
      side == SwapSide.BUY ? to.decimals : from.decimals,
    ).toString();

    const tradeInfo = getTradeInfo(pool.state, blockNumber, direction);

    const unit =
      side == SwapSide.BUY
        ? await this.getBuyPrice(tradeInfo, BigInt(unitAmount))
        : await this.getSellPrice(tradeInfo, BigInt(unitAmount));

    const prices =
      side == SwapSide.BUY
        ? await Promise.all(
            amounts.map(amount =>
              this.getBuyPrice(tradeInfo, BigInt(amount.toString())),
            ),
          )
        : await Promise.all(
            amounts.map(amount =>
              this.getSellPrice(tradeInfo, BigInt(amount.toString())),
            ),
          );

    return {
      prices: prices.map(p => BigInt(p.toString())),
      unit: BigInt(unit.toString()),
      data: {
        router: this.config.routerAddress,
        path: [from.address.toLowerCase(), to.address.toLowerCase()],
        factory: this.config.factoryAddress,
        pools: [
          {
            address: pool.poolAddress,
            fee: tradeInfo.feeInPrecision.toString(),
            direction,
          },
        ],
      },
      exchange: this.dexKey,
      poolIdentifier,
      gasCost: this.config.poolGasCost,
      poolAddresses: [pool.poolAddress],
    };
  }

  private async catchUpPair(from: Token, to: Token, blockNumber: number) {
    if (!blockNumber) return;

    const pair = await this.findPair(from, to);

    if (!pair || !pair.exchanges.length) return;
    if (
      Object.keys(pair.pools).length &&
      !Object.values(pair.pools).find(pool => !pool.getState(blockNumber))
    )
      return;

    if (Object.keys(pair.pools).length !== 0) {
      return;
    }

    this.addPool(pair, blockNumber);

    Object.keys(pair.pools).map(async poolAddress => {
      const pool = pair.pools[poolAddress];
      let state = await pool.getState(blockNumber);
      if (state) {
        return;
      }

      const newState = await pool.generateState();
      pool.setState(newState, blockNumber);
    });
    //
    // let poolsState = await this.getManyPoolReserves(pair, blockNumber);
    //
    // if (!Object.keys(poolsState).length) {
    //   this.logger.error(
    //     `${this.dexKey}_getManyPoolReserves didn't get any pool reserves`,
    //   );
    //   return;
    // }
    //
    // // Filter out pools
    // if (pair.exchanges.length > MAX_TRACKED_PAIR_POOLS) {
    //   poolsState = Object.fromEntries(
    //     Object.entries(poolsState)
    //       .sort(([, stateA], [, stateB]) =>
    //         stateA.reserves.reserves0 < stateB.reserves.reserves0 ? 1 : -1,
    //       )
    //       .slice(0, MAX_TRACKED_PAIR_POOLS),
    //   );
    //   pair.exchanges = pair.exchanges.filter(pool => poolsState[pool]);
    // }
    //
    // Object.entries(poolsState).forEach(([poolAddress, state]) => {
    //   if (!pair.pools[poolAddress]) {
    //     this.addPool(pair, poolAddress, state, blockNumber);
    //   } else pair.pools[poolAddress].setState(state, blockNumber);
    // });
  }

  private async getPairOrderedParams(
    from: Token,
    to: Token,
    blockNumber: number,
  ): Promise<KyberDmmPoolOrderedParams | null> {
    const pair = await this.findPair(from, to);
    if (!(pair && Object.keys(pair.pools).length && pair.exchanges.length))
      return null;

    const pairStatePromiseResults = await Promise.all(
      Object.entries(pair.pools).map(async ([poolAddress, pool]) => {
        const state = (await pool.getState(blockNumber)) as KyberDmmPoolState;
        return {
          poolAddress,
          state: state,
          ampBps: pool.ampBps,
        };
      }),
    );
    const pairState = pairStatePromiseResults.filter(s => s.state);

    if (!pairState.length) {
      this.logger.error(
        `${this.dexKey}_orderPairParams expected reserves, got none (maybe the pool doesn't exist)`,
        from.symbol || from.address,
        to.symbol || to.address,
      );
      return null;
    }
    const pairReversed =
      pair.token1.address.toLowerCase() === from.address.toLowerCase();

    return {
      tokenIn: from.address,
      tokenOut: to.address,
      poolData: pairState,
      exchanges: pair.exchanges,
      direction: !pairReversed,
    };
  }

  private async findPair(from: Token, to: Token) {
    if (from.address.toLowerCase() === to.address.toLowerCase()) return null;
    const [token0, token1] =
      from.address.toLowerCase() < to.address.toLowerCase()
        ? [from, to]
        : [to, from];

    const key = `${token0.address.toLowerCase()}-${token1.address.toLowerCase()}`;
    let pair = this.pairs[key];
    if (pair) return pair;
    const exchanges = await this.factory.methods
      .getPools(token0.address, token1.address)
      .call();
    if (!exchanges || !exchanges.length) {
      pair = { token0, token1, exchanges: [], pools: {} };
    } else {
      pair = { token0, token1, exchanges, pools: {} };
    }
    this.pairs[key] = pair;
    return pair;
  }

  private async getBuyPrice(priceParams: TradeInfo, amountOut: bigint) {
    const {
      reserves0: reserveIn,
      reserves1: reserveOut,
      vReserves0: vReserveIn,
      vReserves1: vReserveOut,
      feeInPrecision,
    } = priceParams;
    if (amountOut <= 0) return 0;
    if (reserveIn <= 0n || reserveOut <= amountOut) return 0;

    let numerator = vReserveIn * amountOut;
    let denominator = vReserveOut - amountOut;
    const amountIn = numerator / denominator + 1n;
    // amountIn = floor(amountIN *PRECISION / (PRECISION - feeInPrecision));
    numerator = amountIn * PRECISION;
    denominator = PRECISION - feeInPrecision;
    return (numerator + denominator - 1n) / denominator;
  }

  private async getSellPrice(priceParams: TradeInfo, amountIn: bigint) {
    const {
      reserves0: reserveIn,
      reserves1: reserveOut,
      vReserves0: vReserveIn,
      vReserves1: vReserveOut,
      feeInPrecision,
    } = priceParams;
    if (amountIn <= 0) return 0;
    if (reserveIn <= 0 || reserveOut <= 0) return 0;

    const amountInWithFee =
      (amountIn * (PRECISION - feeInPrecision)) / PRECISION;
    const numerator = amountInWithFee * vReserveOut;
    const denominator = vReserveIn + amountInWithFee;
    const amountOut = numerator / denominator;
    if (reserveOut <= amountOut) return 0;
    return amountOut;
  }
}
