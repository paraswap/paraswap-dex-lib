import { AsyncOrSync } from 'ts-essentials';
import {
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
} from '../../types';
import { SwapSide, Network } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { bigIntify, getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  AllOrderBooks,
  LighterV1Data,
  LimitOrder,
  OrderBook,
  OrderBookType,
} from './types';
import { SimpleExchange } from '../simple-exchange';
import { LighterV1Config, Adapters } from './config';
import { LighterV1EventPool } from './lighter-v1-pool';
import { Interface } from 'ethers/lib/utils';

import LighterV1OrderBookHelperIface from './abi/order_book_helper.json';
import LighterV1FactoryIface from './abi/factory.json';
import LighterV1RouterIface from './abi/router.json';
import Erc20Iface from './abi/erc20.json';
import { ethers } from 'ethers';

export class LighterV1 extends SimpleExchange implements IDex<LighterV1Data> {
  // protected eventPools: LighterV1EventPool;

  readonly hasConstantPriceLargeAmounts = false;
  // TODO: set true here if protocols works only with wrapped asset
  readonly needWrapNative = true;

  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(LighterV1Config);

  public readonly factoryIface = new Interface(LighterV1FactoryIface);
  public readonly routerIface = new Interface(LighterV1RouterIface);
  public readonly orderBookHelperIface = new Interface(
    LighterV1OrderBookHelperIface,
  );

  public allSupportedOrderBooks: AllOrderBooks = new Map<
    string,
    OrderBookType
  >();

  logger: Logger;

  public orderBooks: Map<number, LighterV1EventPool> = new Map<
    number,
    LighterV1EventPool
  >();

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    public config = LighterV1Config[dexKey][network],
    protected adapters = Adapters[network] || {}, // TODO: add any additional optional params to support other fork DEXes
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    await this.updatePoolState(blockNumber);
  }

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  // Returns list of pool identifiers that can be used
  // for a given swap. poolIdentifiers must be unique
  // across DEXes. It is recommended to use
  // ${dexKey}_${poolAddress} as a poolIdentifier
  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    if (side == SwapSide.BUY) {
      return [];
    }

    const _srcToken = this.dexHelper.config.wrapETH(srcToken);
    const _destToken = this.dexHelper.config.wrapETH(destToken);

    const keyForAsk = `${_srcToken.address}-${_destToken.address}`;
    const keyForBid = `${_destToken.address}-${_srcToken.address}`;

    const orderBookForAsk = this.allSupportedOrderBooks.get(keyForAsk);

    if (orderBookForAsk) {
      return [`${this.dexKey}_${keyForAsk}`];
    }

    const orderBookForBid = this.allSupportedOrderBooks.get(keyForBid);

    if (orderBookForBid) {
      return [`${this.dexKey}_${keyForBid}}`];
    }

    return [];
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
  ): Promise<null | ExchangePrices<LighterV1Data>> {
    const poolIdentifier = await this.getPoolIdentifiers(
      srcToken,
      destToken,
      side,
      blockNumber,
    );

    if (poolIdentifier.length == 0) {
      return null;
    }

    // LighterV1_0x82aF49447D8a07e3bd95BD0d56f35241523fBab1_0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8
    // omit LighterV1 from this string, split
    const key = poolIdentifier[0].split('_')[1];

    const orderBookType = this.allSupportedOrderBooks.get(key);

    if (!orderBookType) {
      return null;
    }

    const pool = this.orderBooks.get(orderBookType.orderBookId);

    if (!pool) {
      return null;
    }

    let state = pool.getState(blockNumber);

    if (!state) {
      state = await pool.generateState(blockNumber);
    }

    const orderBookData = state.orderBook;
    const limitOrders = orderBookType.isAsk
      ? orderBookData.sortedBids
      : orderBookData.sortedAsks;

    const outAmounts: bigint[] = await this.getOutAmount(
      amounts,
      orderBookType.isAsk,
      limitOrders,
      state.sizeTick,
    );

    return [
      {
        prices: outAmounts,
        unit: bigIntify(0),
        data: { exchange: this.dexKey },
        poolIdentifier: poolIdentifier[0],
        exchange: this.dexKey,
        gasCost: CALLDATA_GAS_COST.DEX_NO_PAYLOAD,
        poolAddresses: [pool.orderBookAddress],
      },
    ];
  }

  async getOutAmount(
    amountIns: bigint[],
    isAsk: boolean,
    limitOrders: Readonly<LimitOrder[]>,
    sizeTick: Readonly<bigint>,
  ): Promise<bigint[]> {
    return amountIns.map(amountIn => {
      // This is important, reviewer should check this
      // there is a size tick in the order book and we need to round the amountIn
      if (isAsk) {
        amountIn -= amountIn % BigInt(sizeTick);
      }

      let remainingAmountIn = amountIn;
      let runningAmountOut = BigInt(0);

      let partialAmountOut = BigInt(0);
      let orderAmountIn = BigInt(0);
      let orderAmountOut = BigInt(0);
      for (
        let i = 0;
        i < limitOrders.length && remainingAmountIn > BigInt(0);
        i++
      ) {
        if (isAsk != limitOrders[i].isAsk) {
          orderAmountIn = limitOrders[i].amount0;
          orderAmountOut = limitOrders[i].amount1;

          if (remainingAmountIn >= orderAmountIn) {
            runningAmountOut += orderAmountOut;
            remainingAmountIn -= orderAmountIn;
          } else {
            partialAmountOut =
              (remainingAmountIn * orderAmountOut) / orderAmountIn;
            if (!isAsk) {
              partialAmountOut -= partialAmountOut % BigInt(sizeTick);
            }
            runningAmountOut += partialAmountOut;
            remainingAmountIn -=
              (partialAmountOut * orderAmountIn) / orderAmountOut;

            break;
          }
        }
      }
      return runningAmountOut;
    });
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<LighterV1Data>): number | number[] {
    // TODO: update if there is any payload in getAdapterParam
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  // Encode params required by the exchange adapter
  // Used for multiSwap, buy & megaSwap
  // Hint: abiCoder.encodeParameter() could be useful
  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: LighterV1Data,
    side: SwapSide,
  ): AdapterExchangeParam {
    const { exchange } = data;

    // Encode here the payload for adapter
    const payload = '';

    return {
      targetExchange: exchange,
      payload,
      networkFee: '0',
    };
  }

  // Encode call data used by simpleSwap like routers
  // Used for simpleSwap & simpleBuy
  // Hint: this.buildSimpleParamWithoutWETHConversion
  // could be useful
  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: LighterV1Data,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    if (side == SwapSide.BUY) {
      throw new Error('Buy not supported');
    }

    const poolIdentifier = await this.getPoolIdentifiers(
      { address: srcToken, decimals: 0 },
      { address: destToken, decimals: 0 },
      SwapSide.SELL,
      0,
    );

    if (poolIdentifier.length == 0) {
      throw new Error('Pool identifier not found');
    }

    const key = poolIdentifier[0].split('_')[1];

    const orderBookType = this.allSupportedOrderBooks.get(key);

    if (!orderBookType) {
      throw new Error('Order book type not found');
    }

    // Encode here the transaction arguments
    const helper = new ethers.Contract(
      this.config.orderBookHelper,
      this.orderBookHelperIface,
    );

    const payload = helper.interface.encodeFunctionData('swapExactInput', [
      orderBookType.orderBookId,
      orderBookType.isAsk,
      srcAmount,
      destAmount,
    ]);

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      payload,
      helper.address,
    );
  }

  async getQuoteFromHelper(
    blockNumber: number,
    orderBookId: number,
    amountIn: bigint,
    isAsk: boolean,
  ): Promise<bigint> {
    const helper = new ethers.Contract(
      this.config.orderBookHelper,
      this.orderBookHelperIface,
    );

    const data = await this.dexHelper.provider.call(
      {
        to: helper.address,
        data: helper.interface.encodeFunctionData('quoteExactInput', [
          orderBookId,
          isAsk,
          amountIn,
        ]),
      },
      blockNumber,
    );

    const [amountInResult, amountOut] = helper.interface.decodeFunctionResult(
      'quoteExactInput',
      data,
    );

    return amountOut;
  }

  // This is called once before getTopPoolsForToken is
  // called for multiple tokens. This can be helpful to
  // update common state required for calculating
  // getTopPoolsForToken. It is optional for a DEX
  // to implement this
  async updatePoolState(blockNumber?: number): Promise<void> {
    const helper = new ethers.Contract(
      this.config.orderBookHelper,
      this.orderBookHelperIface,
    );

    const block = blockNumber
      ? blockNumber
      : await this.dexHelper.provider.getBlockNumber();

    const data = await this.dexHelper.provider.call(
      {
        to: helper.address,
        data: helper.interface.encodeFunctionData('getAllOrderBooks', []),
      },
      block,
    );

    const [orderBookIds, orderBookAddresses, token0s, token1s, sizeTicks, _] =
      helper.interface.decodeFunctionResult('getAllOrderBooks', data);

    for (let i = 0; i < orderBookIds.length; i++) {
      // Generate keys for both sides of each order book
      const keyForAsk = `${token0s[i]}-${token1s[i]}`;
      const keyForBid = `${token1s[i]}-${token0s[i]}`;

      if (!this.allSupportedOrderBooks.has(keyForAsk)) {
        // Construct the OrderBookType objects
        const orderBookForAsk = { orderBookId: orderBookIds[i], isAsk: true };
        const orderBookForBid = { orderBookId: orderBookIds[i], isAsk: false };

        // Add the order books to the map
        this.allSupportedOrderBooks.set(keyForAsk, orderBookForAsk);
        this.allSupportedOrderBooks.set(keyForBid, orderBookForBid);
      }

      let pool: LighterV1EventPool;

      if (!this.orderBooks.has(orderBookIds[i])) {
        const token0 = new ethers.Contract(
          token0s[i],
          Erc20Iface,
          this.dexHelper.provider,
        );
        const token1 = new ethers.Contract(
          token1s[i],
          Erc20Iface,
          this.dexHelper.provider,
        );
        // get token symbol
        const token0Symbol = await token0.symbol();
        const token1Symbol = await token1.symbol();

        // get token decimals
        const token0Decimals = await token0.decimals();
        const token1Decimals = await token1.decimals();

        const baseToken: Token = {
          address: token0s[i],
          decimals: token0Decimals,
          symbol: token0Symbol,
        };

        const quoteToken: Token = {
          address: token1s[i],
          decimals: token1Decimals,
          symbol: token1Symbol,
        };
        // create pool
        pool = new LighterV1EventPool(
          this.dexKey,
          this.network,
          this.dexHelper,
          this.logger,
          this.config.factory,
          this.config.router,
          orderBookIds[i],
          orderBookAddresses[i],
          baseToken,
          quoteToken,
          sizeTicks[i],
        );

        this.orderBooks.set(orderBookIds[i], pool);
      }

      pool = this.orderBooks.get(orderBookIds[i])!;

      const state = await pool.generateState(block);
      pool.setState(state, block);
    }
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    const pools: PoolLiquidity[] = [];

    // find the pools that have the token in allSupportedOrderBooks keys
    for (const [key, orderBookType] of this.allSupportedOrderBooks) {
      if (pools.length >= limit) {
        break;
      }
      const [token0, token1] = key.split('-');
      // if one of these tokens is given token
      if (token0 == tokenAddress) {
        const pool = this.orderBooks.get(orderBookType.orderBookId);

        if (!pool) {
          continue;
        }

        const state = pool.getState(pool.getStateBlockNumber());

        if (!state) {
          continue;
        }

        const liq = await pool.calculateLiquidity();

        // find the connector token,
        // if token0 is the given token, then token1 is the connector token

        const connectorToken =
          tokenAddress == state.baseToken.address
            ? state.quoteToken
            : state.baseToken;

        pools.push({
          exchange: this.dexKey,
          address: this.config.orderBookHelper,
          connectorTokens: [connectorToken],
          liquidityUSD: liq,
        });
      }
    }
    return pools;
  }

  // This is optional function in case if your implementation has acquired any resources
  // you need to release for graceful shutdown. For example, it may be any interval timer
  releaseResources(): AsyncOrSync<void> {
    // TODO: complete me!
  }
}
