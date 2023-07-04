import { AsyncOrSync } from 'ts-essentials';
import _ from 'lodash';
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
import { SwapSide, Network, ETHER_ADDRESS } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { CarbonData } from './types';
import { SimpleExchange } from '../simple-exchange';
import { CarbonConfig, Adapters } from './config';
import { CarbonEventPool } from './carbon-pool';
import { getBigIntPow } from '../../utils';
import { getBigNumberPow } from '../../bignumber-constants';
import BigNumber from 'bignumber.js';
import { Action, MatchActionBNStr, TradeActionBNStr } from './sdk/common/types';
import { formatUnits } from './sdk/utils';
import { Toolkit } from './sdk/strategy-management';
import { ContractsApi } from './sdk/contracts-api';
import { ChainCache } from './sdk/chain-cache';
import { PopulatedTransaction } from '@ethersproject/contracts';

const GAS_COST_SWAP_YINT_TKN_TKN = 90666;
const GAS_COST_SWAP_YINT_TKN_ETH = 80892;
const GAS_COST_SWAP_YINT_ETH_TKN = 66538;
const GAS_COST_SWAP_SLOPE = 23400;

export class Carbon extends SimpleExchange implements IDex<CarbonData> {
  protected mainPool: CarbonEventPool;

  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = false;
  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(CarbonConfig);

  logger: Logger;

  api: ContractsApi;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
    protected config = CarbonConfig[dexKey][network],
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    this.mainPool = new CarbonEventPool(
      dexKey,
      network,
      dexHelper,
      this.logger,
    );

    this.api = new ContractsApi(dexHelper.provider, {});
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    // Initialize state
    try {
      await this.mainPool.initialize(blockNumber);
    } catch (e) {
      this.logger.error(`Error ${this.dexKey} initializing pricing: `, e);
    }
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
    const tradeByTargetAmount: boolean = side === SwapSide.BUY;

    const tokenSell = tradeByTargetAmount
      ? destToken.address.toLowerCase()
      : srcToken.address.toLowerCase();
    const tokenBuy = tradeByTargetAmount
      ? srcToken.address.toLowerCase()
      : destToken.address.toLowerCase();

    const state = this.mainPool.getState(blockNumber);

    const cache = state?.sdkCache as ChainCache;

    if (!cache) return [];

    const orders = await cache.getOrdersByPair(tokenSell, tokenBuy);

    this.logger.info(
      `getPoolIdentifiers: Number of tradeable orders for the pair ${tokenSell}-${tokenBuy}: ${
        Object.keys(orders).length
      }`,
    );

    if (Object.keys(orders).length == 0) {
      this.logger.error(`No Liquidity for pair ${tokenSell} - ${tokenBuy}`);
      return [];
    }

    let orderIds: string[] = Object.entries(orders).map(([orderId, _]) => {
      return `${this.dexKey}_${orderId}`;
    });

    return orderIds;
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
  ): Promise<null | ExchangePrices<CarbonData>> {
    // if side is BUY, amount numeraire is destToken, destToken -> srcToken (tradeByTarget == true)
    // if side is SELL, amount numeraire is srcToken, srcToken -> destToken (tradeByTarget == false)

    if (srcToken.address.toLowerCase() === destToken.address.toLowerCase()) {
      return null;
    }

    const state = this.mainPool.getState(blockNumber);
    const cache = state?.sdkCache as ChainCache;

    if (!cache) return null;

    let tradeDataPerAmount: {
      tradeActions: TradeActionBNStr[];
      actionsTokenRes: Action[];
      totalSourceAmount: string;
      totalTargetAmount: string;
      effectiveRate: string;
      actionsWei: MatchActionBNStr[];
    };

    let tradeActions: TradeActionBNStr[][] = [];
    let prices: bigint[] = [];
    let gasCosts: number[] = [];

    const tradeByTargetAmount: boolean = side === SwapSide.BUY;

    const gas_cost_yint =
      srcToken.address.toLowerCase() === ETHER_ADDRESS ||
      destToken.address.toLowerCase() === ETHER_ADDRESS
        ? tradeByTargetAmount &&
          srcToken.address.toLowerCase() === ETHER_ADDRESS
          ? GAS_COST_SWAP_YINT_TKN_ETH
          : GAS_COST_SWAP_YINT_ETH_TKN
        : GAS_COST_SWAP_YINT_TKN_TKN;

    const toolkit = new Toolkit(this.api, cache);

    // Get trade data for amounts
    for (let amount of amounts) {
      // Get trade route
      tradeDataPerAmount = await toolkit.getTradeData(
        srcToken.address.toLowerCase(),
        destToken.address.toLowerCase(),
        amount.toString(),
        tradeByTargetAmount,
      );

      if (!tradeDataPerAmount) continue;

      tradeActions.push(tradeDataPerAmount.tradeActions);

      const price = BigInt(
        tradeByTargetAmount
          ? Number(tradeDataPerAmount.totalSourceAmount) *
              10 ** srcToken.decimals
          : Number(tradeDataPerAmount.totalTargetAmount) *
              10 ** destToken.decimals,
      );

      prices.push(price);

      gasCosts.push(
        price === 0n
          ? 0
          : gas_cost_yint +
              tradeDataPerAmount.tradeActions.length * GAS_COST_SWAP_SLOPE,
      );
    }

    // Get unit amount
    const unitAmount = getBigIntPow(
      tradeByTargetAmount ? destToken.decimals : srcToken.decimals,
    );

    let unitTradeData: typeof tradeDataPerAmount = await toolkit.getTradeData(
      srcToken.address.toLowerCase(),
      destToken.address.toLowerCase(),
      unitAmount.toString(),
      tradeByTargetAmount,
    );

    let unit: bigint = BigInt(
      tradeByTargetAmount
        ? Number(unitTradeData.totalSourceAmount) * 10 ** srcToken.decimals
        : Number(unitTradeData.totalTargetAmount) * 10 ** destToken.decimals,
    );

    return [
      {
        unit: unit,
        prices: prices,
        data: {
          tradeActions: tradeActions,
          cache: cache,
          decimals: {
            [srcToken.address]: srcToken.decimals,
            [destToken.address]: destToken.decimals,
          },
        },
        exchange: this.dexKey,
        gasCost: gasCosts,
      },
    ];
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<CarbonData>): number | number[] {
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
    data: CarbonData,
    side: SwapSide,
  ): AdapterExchangeParam {
    // TODO: complete me!
    // const { exchange } = data;

    // Encode here the payload for adapter
    const payload = '';

    return {
      targetExchange: this.config.carbonController,
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
    data: CarbonData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const tradeByTargetAmount: boolean = side === SwapSide.BUY;

    this.logger.info(
      `getSimpleParam: length of trade actions ${
        Object.keys(data.tradeActions).length
      }`,
    );

    const output = BigInt(tradeByTargetAmount ? srcAmount : destAmount);
    const amount = BigInt(tradeByTargetAmount ? destAmount : srcAmount);

    // Set deadline in ms
    const deadline = 10; // mins
    const delta_deadline = new BigNumber(deadline).times(60).times(1000); // MS
    const deadlineInMs = delta_deadline.plus(Date.now()).toString(); // MS

    const api = new ContractsApi(this.dexHelper.provider);

    const toolkit = new Toolkit(
      api,
      data.cache,
      address => data.decimals[address],
    );

    const tradeData = await toolkit.getTradeData(
      srcToken.toLowerCase(),
      destToken.toLowerCase(),
      amount.toString(),
      tradeByTargetAmount,
    );

    let encodedData: PopulatedTransaction;
    if (tradeByTargetAmount) {
      encodedData = await toolkit.composeTradeByTargetTransaction(
        srcToken.toLowerCase(),
        destToken.toLowerCase(),
        tradeData.tradeActions,
        deadlineInMs,
        output.toString(),
      );
    } else {
      encodedData = await toolkit.composeTradeBySourceTransaction(
        srcToken.toLowerCase(),
        destToken.toLowerCase(),
        tradeData.tradeActions,
        deadlineInMs,
        output.toString(),
      );
    }

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken.toLowerCase(),
      srcAmount,
      destToken.toLowerCase(),
      destAmount,
      encodedData.data || '',
      this.config.carbonController,
    );
  }

  // This is called once before getTopPoolsForToken is
  // called for multiple tokens. This can be helpful to
  // update common state required for calculating
  // getTopPoolsForToken. It is optional for a DEX
  // to implement this
  async updatePoolState(): Promise<void> {
    // TODO: complete me!
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    if (!this.config.subgraphURL) return [];

    const _tokenAddress = tokenAddress.toLowerCase();

    const query = `
    query ($token: Bytes!, $count: Int) {
      orders0: orders(first: $count, orderBy: y, orderDirection: desc, where: {type: "order0", y_gt: 0, strategy_: {token0: $token}}) {
        pair {
          id
        }
        strategy {
          id,
          token0 {
            decimals
          },
          token1 {
            id
          }
        }
        y
      }
      orders1: orders(first: $count, orderBy: y, orderDirection: desc, where: {type: "order1", y_gt: 0, strategy_: {token1: $token}}) {
        pair {
          id
        }
        strategy {
          id,
          token0 {
            id
          }
          token1 {
            decimals
          }
        }
        y
      }
    }
    `;

    const data = await this.mainPool._querySubgraph(
      query,
      {
        token: _tokenAddress.toLowerCase(),
        count: limit,
      },
      this.config.subgraphURL,
    );

    if (!(data && data.orders0 && data.orders1)) {
      this.logger.error(
        `Error_${this.dexKey}_Subgraph: couldn't fetch the orders from the subgraph`,
      );
      return [];
    }

    let tokenDecimals: number =
      data.orders0[0].strategy.token0.decimals ||
      data.orders1[0].strategy.token1.decimals;

    const tokenPriceUsd = await this.dexHelper.getTokenUSDPrice(
      {
        address: _tokenAddress.toLowerCase(),
        decimals: tokenDecimals,
      },
      BigInt(getBigNumberPow(tokenDecimals).toFixed(0)),
    );

    const orders0 = _.map(data.orders0, order => ({
      exchange: this.dexKey,
      address: order.strategy.id,
      connectorTokens: [
        {
          address: order.strategy.token1.id,
          decimals: order.strategy.token0.decimals,
        },
      ],
      liquidityUSD: Number(formatUnits(order.y, tokenDecimals)) * tokenPriceUsd,
    }));

    const orders1 = _.map(data.orders1, order => ({
      exchange: this.dexKey,
      address: order.strategy.id,
      connectorTokens: [
        {
          address: order.strategy.token0.id,
          decimals: order.strategy.token1.decimals,
        },
      ],
      liquidityUSD: Number(formatUnits(order.y, tokenDecimals)) * tokenPriceUsd,
    }));

    const orders = _.slice(
      _.sortBy(_.concat(orders0, orders1), [order => -1 * order.liquidityUSD]),
      0,
      limit,
    );

    return orders;
  }

  // This is optional function in case if your implementation has acquired any resources
  // you need to release for graceful shutdown. For example, it may be any interval timer
  releaseResources(): AsyncOrSync<void> {}
}
