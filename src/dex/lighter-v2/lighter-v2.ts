import { AsyncOrSync, DeepReadonly } from 'ts-essentials';
import {
  AdapterExchangeParam,
  Address,
  ExchangePrices,
  Logger,
  PoolLiquidity,
  PoolPrices,
  SimpleExchangeParam,
  Token,
} from '../../types';
import { ETHER_ADDRESS, Network, SwapSide } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { bigIntify, getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { DexParams, LighterV2Data, LimitOrder, PoolState } from './types';
import { SimpleExchange } from '../simple-exchange';
import { Adapters, LighterV2Config } from './config';
import { LighterV2EventPool } from './lighter-v2-pool';
import { ethers } from 'ethers';
import { Interface } from '@ethersproject/abi';
import LighterV2FactoryABI from '../../abi/lighter-v2/Factory.json';
import LighterV2RouterABI from '../../abi/lighter-v2/Router.json';
import ERC20ABI from '../../abi/ERC20.abi.json';
import { BI_POWS } from '../../bigint-constants';
import {
  getSwapExactInputSingleFallbackData,
  getSwapExactOutputSingleFallbackData,
} from './fallback';
import { LighterPriceOracle } from './price-oracle';

export class LighterV2 extends SimpleExchange implements IDex<LighterV2Data> {
  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = false;

  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(LighterV2Config);

  logger: Logger;

  readonly ERC20Interface = new Interface(ERC20ABI);
  readonly routerContract: ethers.Contract;
  readonly factoryContract: ethers.Contract;
  readonly config: DexParams;

  tokens = new Map<string, Token>();

  allSupportedOrderBooks = new Map<
    string,
    { pool: LighterV2EventPool; isAsk: boolean }
  >();

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {}, // TODO: add any additional optional params to support other fork DEXes

    // consider passing an external priceOracle so different chain integrations will share the same price oracle cache
    readonly priceOracle: LighterPriceOracle = new LighterPriceOracle(
      dexHelper.httpRequest,
    ),
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    this.config = LighterV2Config.LighterV2[network];

    this.factoryContract = new ethers.Contract(
      this.config.factory,
      new Interface(LighterV2FactoryABI),
      this.dexHelper.provider,
    );

    this.routerContract = new ethers.Contract(
      this.config.router,
      new Interface(LighterV2RouterABI),
      this.dexHelper.provider,
    );
  }

  getTokenFromAddress(address: Address): Token {
    const token = this.tokens.get(address.toLowerCase());
    if (token == null) {
      throw `can't find token with address ${address} on ${this.network}`;
    }
    return token;
  }

  async initializeTokens(tokenAddresses: string[]) {
    // unique & lowercase
    tokenAddresses = [...new Set(tokenAddresses)].map(address =>
      address.toLowerCase(),
    );

    // set type of calldata
    const paramsCalldata: {
      target: string;
      callData: string;
    }[] = [];

    // add 2 calls for each token, first for symbol and decimals
    tokenAddresses.forEach(address => {
      paramsCalldata.push(
        {
          target: address,
          callData: this.ERC20Interface.encodeFunctionData('symbol'),
        },
        {
          target: address,
          callData: this.ERC20Interface.encodeFunctionData('decimals'),
        },
      );
    });

    const paramsResults: ethers.utils.BytesLike[] = (
      await this.dexHelper.multiContract.methods
        .aggregate(paramsCalldata)
        .call({})
    ).returnData;

    for (let i = 0; i < paramsResults.length; i += 2) {
      const symbol = this.ERC20Interface.decodeFunctionResult(
        'symbol',
        paramsResults[i],
      );
      const decimals = this.ERC20Interface.decodeFunctionResult(
        'decimals',
        paramsResults[i + 1],
      );
      const tokenAddress = tokenAddresses[i / 2];

      this.tokens.set(tokenAddress, {
        address: tokenAddress,
        symbol: String(symbol),
        decimals: Number(decimals),
      });
    }
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    const allOrderBooks =
      await this.factoryContract.callStatic.getAllOrderBooksDetails();

    // make sure all tokens are loaded
    let tokens = [];
    for (const orderBook of allOrderBooks) {
      tokens.push(orderBook.token0);
      tokens.push(orderBook.token1);
    }
    await this.initializeTokens(tokens);

    let promises = [];
    for (const orderBook of allOrderBooks) {
      if (
        this.allSupportedOrderBooks.has(
          `${orderBook.token0}-${orderBook.token1}`,
        )
      ) {
        continue;
      }

      const priceTick =
        (BI_POWS[this.getTokenFromAddress(orderBook.token0).decimals] *
          bigIntify(orderBook.priceMultiplier)) /
        bigIntify(orderBook.priceDivider) /
        bigIntify(orderBook.sizeTick);

      const pool = new LighterV2EventPool(
        this.dexKey,
        this.network,
        this.dexHelper,
        this.logger,
        orderBook.orderBookAddress,
        orderBook.orderBookId,
        this.getTokenFromAddress(orderBook.token0),
        this.getTokenFromAddress(orderBook.token1),
        bigIntify(orderBook.sizeTick),
        priceTick,
      );

      this.allSupportedOrderBooks.set(
        `${orderBook.token0}-${orderBook.token1}`,
        {
          pool,
          isAsk: true,
        },
      );
      this.allSupportedOrderBooks.set(
        `${orderBook.token1}-${orderBook.token0}`,
        {
          pool,
          isAsk: false,
        },
      );

      promises.push(pool.initState(blockNumber));
    }

    await Promise.all(promises);
  }

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  // Returns list of pool identifiers that can be used
  // for a given swap. poolIdentifiers must be unique
  // across DEXes. It is recommended to use
  // ${dexKey}_${srcToken}-${destToken} as a poolIdentifier
  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    srcToken = this.dexHelper.config.wrapETH(srcToken);
    destToken = this.dexHelper.config.wrapETH(destToken);

    for (const key of [
      `${srcToken.address}-${destToken.address}`,
      `${destToken.address}-${srcToken.address}`,
    ]) {
      if (this.allSupportedOrderBooks.get(key)) {
        return [`${this.dexKey}_${key}`];
      }
    }

    return [];
  }

  getPoolByIdentifier(identifier: string) {
    const [_, key] = identifier.split('_');
    return this.allSupportedOrderBooks.get(key);
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
  ): Promise<null | ExchangePrices<LighterV2Data>> {
    const isNativeSrcToken = srcToken.address == ETHER_ADDRESS;
    srcToken = this.dexHelper.config.wrapETH(srcToken);
    destToken = this.dexHelper.config.wrapETH(destToken);
    const poolIdentifier = await this.getPoolIdentifiers(
      srcToken,
      destToken,
      side,
      blockNumber,
    );

    if (poolIdentifier.length == 0) {
      return null;
    }

    // LighterV2_0x82aF49447D8a07e3bd95BD0d56f35241523fBab1-0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8
    // omit LighterV2 from this string, split
    const [_, key] = poolIdentifier[0].split('_');
    const orderBook = this.allSupportedOrderBooks.get(key);
    if (!orderBook) {
      return null;
    }

    let state = orderBook.pool.getState(blockNumber);
    if (!state) {
      state = await orderBook.pool.initState(blockNumber);
    }

    const orderBookData = state.orderBook;
    const limitOrders = orderBook.isAsk
      ? orderBookData.sortedBids
      : orderBookData.sortedAsks;

    const outAmounts: bigint[] = await this.getOutAmount(
      srcToken,
      destToken,
      state,
      amounts,
      side == SwapSide.SELL,
      orderBook.isAsk,
      limitOrders,
    );

    return [
      {
        prices: outAmounts,
        unit: bigIntify(0),
        data: {
          isAsk: orderBook.isAsk,
          orderBookId: orderBook.pool.orderBookId,
          exchange: this.routerContract.address,
        },
        poolIdentifier: poolIdentifier[0],
        exchange: this.dexKey,
        gasCost: 105_000 + (isNativeSrcToken ? 25_000 : 0),
        poolAddresses: [orderBook.pool.orderBookAddress],
      },
    ];
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<LighterV2Data>): number | number[] {
    // size is actually variable between 10 and 18, depending on the numbers and how compressed they are
    return CALLDATA_GAS_COST.wordNonZeroBytes(18);
  }

  // Encode params required by the exchange adapter
  // Used for multiSwap, buy & megaSwap
  // Hint: abiCoder.encodeParameter() could be useful
  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: LighterV2Data,
    side: SwapSide,
  ): AdapterExchangeParam {
    // TODO: complete me!
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
    data: LighterV2Data,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const { exchange, isAsk, orderBookId } = data;

    // Encode here the transaction arguments
    const swapData =
      side == SwapSide.SELL
        ? getSwapExactInputSingleFallbackData(
            orderBookId,
            isAsk,
            srcAmount,
            destAmount,
            destToken == ETHER_ADDRESS,
          )
        : getSwapExactOutputSingleFallbackData(
            orderBookId,
            isAsk,
            destAmount,
            srcAmount,
            destToken == ETHER_ADDRESS,
          );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      exchange,
    );
  }

  // This is called once before getTopPoolsForToken is
  // called for multiple tokens. This can be helpful to
  // update common state required for calculating
  // getTopPoolsForToken. It is optional for a DEX
  // to implement this
  async updatePoolState(): Promise<void> {
    await this.initializePricing(
      await this.dexHelper.provider.getBlockNumber(),
    );
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    const pools: PoolLiquidity[] = [];

    // find the pools that have the token in allSupportedOrderBooks keys
    for (const [key, orderBook] of this.allSupportedOrderBooks) {
      if (pools.length >= limit) {
        break;
      }
      const [tokenAAddress, tokenBAddress] = key.split('-');
      // if one of these tokens is given token
      if (tokenAAddress == tokenAddress) {
        const tokenB = this.getTokenFromAddress(tokenBAddress);

        const pool = orderBook.pool;
        const state = pool.getState(pool.getStateBlockNumber());
        if (!state) {
          continue;
        }

        const liq = pool.getLockedAssets(state);
        const token0Liq = this.priceOracle.getTokenValue(
          state.token0,
          liq.token0Amount,
        );
        const token1Liq = this.priceOracle.getTokenValue(
          state.token1,
          liq.token1Amount,
        );

        await Promise.all([token0Liq, token1Liq]);

        pools.push({
          exchange: this.dexKey,
          address: pool.orderBookAddress,
          connectorTokens: [tokenB],
          liquidityUSD: (await token0Liq) + (await token1Liq),
        });
      }
    }

    pools.sort((a, b) => {
      return b.liquidityUSD - a.liquidityUSD;
    });

    return pools.slice(0, limit);
  }

  // This is optional function in case if your implementation has acquired any resources
  // you need to release for graceful shutdown. For example, it may be any interval timer
  releaseResources(): AsyncOrSync<void> {}

  async getOutAmount(
    srcToken: Token,
    destToken: Token,
    state: DeepReadonly<PoolState>,
    amountIns: bigint[],
    isExactInput: boolean,
    isAsk: boolean,
    limitOrders: Readonly<LimitOrder[]>,
  ): Promise<bigint[]> {
    const swapToken0For1 = isAsk == isExactInput;
    const token0 = isAsk ? srcToken : destToken;

    return amountIns.map(amountIn => {
      // This is important, reviewer should check this
      // there is a size tick in the order book and we need to round the amountIn
      if (swapToken0For1) {
        if (!isExactInput && amountIn % state.sizeTick != 0n) {
          amountIn += state.sizeTick;
        }
        amountIn -= amountIn % state.sizeTick;
      }

      let remainingAmountIn = amountIn;
      let runningAmountOut = 0n;
      for (const limitOrder of limitOrders) {
        if (isAsk == limitOrder.isAsk) {
          continue;
        }

        let orderAmountIn = limitOrder.amount0;
        let orderPrice = limitOrder.price;
        let orderAmountOut =
          (orderAmountIn * orderPrice) / BI_POWS[token0.decimals];

        if (swapToken0For1) {
          let swapAmount0 =
            remainingAmountIn >= orderAmountIn
              ? orderAmountIn
              : remainingAmountIn;
          let shouldStop = swapAmount0 == orderAmountIn;

          let swapAmount1 =
            (swapAmount0 * orderPrice) / BI_POWS[token0.decimals];

          runningAmountOut += swapAmount1;
          remainingAmountIn -= swapAmount0;

          if (shouldStop) {
            break;
          }
        } else {
          let swapAmount1 =
            remainingAmountIn >= orderAmountOut
              ? orderAmountOut
              : remainingAmountIn;
          let shouldStop = swapAmount1 == remainingAmountIn;

          // compute swapAmount0 based on swapAmount1
          let swapAmount0 =
            (swapAmount1 * BI_POWS[token0.decimals]) / orderPrice;

          if (
            !isExactInput &&
            shouldStop &&
            swapAmount0 % state.sizeTick != 0n
          ) {
            swapAmount0 -= swapAmount0 % state.sizeTick;
            swapAmount0 += state.sizeTick;
          } else {
            swapAmount0 -= swapAmount0 % state.sizeTick;
          }

          // recompute swapAmount1, due to possible precision loss in prev step
          swapAmount1 = (swapAmount0 * orderPrice) / BI_POWS[token0.decimals];

          runningAmountOut += swapAmount0;
          remainingAmountIn -= swapAmount1;

          if (shouldStop) {
            break;
          }
        }
      }
      return runningAmountOut;
    });
  }
}
