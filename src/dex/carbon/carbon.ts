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
      this.logger.error(
        `${this.dexKey} - initializePricing: Error ${this.dexKey} initializing pricing: `,
        e,
      );
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

    if (!cache) {
      this.logger.error(`${this.dexKey} - getPoolIdentifiers: Can't get cache`);
      return [];
    }

    const orders = await cache.getOrdersByPair(tokenSell, tokenBuy);

    this.logger.info(
      `${
        this.dexKey
      } - getPoolIdentifiers: Number of tradeable orders for the pair ${tokenSell}-${tokenBuy}: ${
        Object.keys(orders).length
      }`,
    );

    if (Object.keys(orders).length == 0) {
      this.logger.error(
        `${this.dexKey} - getPoolIdentifiers: No Liquidity for pair ${tokenSell} - ${tokenBuy}`,
      );
      return [];
    }

    const orderIds: string[] = Object.entries(orders).map(([orderId, _]) => {
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
    if (srcToken.address.toLowerCase() === destToken.address.toLowerCase()) {
      return null;
    }

    const state = this.mainPool.getState(blockNumber);
    const cache = state?.sdkCache as ChainCache;

    if (!cache) {
      this.logger.error(`${this.dexKey} - getPricesVolume: Can't get cache`);
      return null;
    }

    let tradeDataPerAmount: {
      tradeActions: TradeActionBNStr[];
      actionsTokenRes: Action[];
      totalSourceAmount: string;
      totalTargetAmount: string;
      effectiveRate: string;
      actionsWei: MatchActionBNStr[];
    };

    let tradeDataMap: {
      [amount: string]: typeof tradeDataPerAmount;
    } = {};

    let prices: bigint[] = [];
    let gasCosts: number[] = [];

    // if side is BUY, amount numeraire is destToken, srcToken -> destToken (tradeByTarget == true)
    // if side is SELL, amount numeraire is srcToken, srcToken -> destToken (tradeByTarget == false)
    const isBuy: boolean = side === SwapSide.BUY;

    const gas_cost_yint =
      srcToken.address.toLowerCase() === ETHER_ADDRESS ||
      destToken.address.toLowerCase() === ETHER_ADDRESS
        ? isBuy && srcToken.address.toLowerCase() === ETHER_ADDRESS
          ? GAS_COST_SWAP_YINT_TKN_ETH
          : GAS_COST_SWAP_YINT_ETH_TKN
        : GAS_COST_SWAP_YINT_TKN_TKN;

    const decimalMap: { [tokenAddress: string]: number } = {
      [srcToken.address.toLowerCase()]: srcToken.decimals,
      [destToken.address.toLowerCase()]: destToken.decimals,
    };

    const toolkit = new Toolkit(
      this.api,
      cache,
      address => decimalMap[address.toLowerCase()] ?? undefined,
    );

    let _amount: string;
    let price: bigint;

    for (const amount of amounts) {
      // Because the toolkit expects floating point amounts
      _amount = isBuy
        ? BigNumber(amount.toString())
            .dividedBy(BigNumber(10).pow(destToken.decimals))
            .toString()
        : BigNumber(amount.toString())
            .dividedBy(BigNumber(10).pow(srcToken.decimals))
            .toString();

      tradeDataPerAmount = await toolkit.getTradeData(
        srcToken.address.toLowerCase(),
        destToken.address.toLowerCase(),
        _amount,
        isBuy,
      );

      if (!tradeDataPerAmount) continue;

      tradeDataMap[amount.toString()] = tradeDataPerAmount;

      price = BigInt(
        isBuy
          ? BigNumber(tradeDataPerAmount.totalSourceAmount)
              .multipliedBy(BigNumber(10).pow(srcToken.decimals))
              .toFixed(0)
          : BigNumber(tradeDataPerAmount.totalTargetAmount)
              .multipliedBy(BigNumber(10).pow(destToken.decimals))
              .toFixed(0),
      );
      prices.push(price);

      gasCosts.push(
        price === 0n
          ? 0
          : gas_cost_yint +
              tradeDataPerAmount.tradeActions.length * GAS_COST_SWAP_SLOPE,
      );
    }

    const unitTradeData: typeof tradeDataPerAmount = await toolkit.getTradeData(
      srcToken.address.toLowerCase(),
      destToken.address.toLowerCase(),
      1n.toString(),
      isBuy,
    );

    const unit = BigInt(
      isBuy
        ? BigNumber(unitTradeData.totalSourceAmount)
            .multipliedBy(BigNumber(10).pow(srcToken.decimals))
            .toFixed(0)
        : BigNumber(unitTradeData.totalTargetAmount)
            .multipliedBy(BigNumber(10).pow(destToken.decimals))
            .toFixed(0),
    );

    return [
      {
        unit: unit,
        prices: prices,
        data: {
          tradeDataMap: tradeDataMap,
          decimals: decimalMap,
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
    // Set to max possible deadline
    const deadline = 30; // mins
    const delta_deadline = new BigNumber(deadline).times(60).times(1000); // MS
    const deadlineInMs = delta_deadline.plus(Date.now()).toString(); // MS

    // Recalculating trade path as srcAmount/destAmount influence which orders to go through
    const toolkit = new Toolkit(
      this.api,
      new ChainCache(),
      address => data.decimals[address.toLowerCase()] ?? undefined,
    );

    const max_slippage = 5; // Max possible setting
    const slippageBn = new BigNumber(max_slippage).div(100);

    let encodedData: PopulatedTransaction;

    const tradeByTargetAmount: boolean = side === SwapSide.BUY;

    const tradeData: {
      tradeActions: TradeActionBNStr[];
      actionsTokenRes: Action[];
      totalSourceAmount: string;
      totalTargetAmount: string;
      effectiveRate: string;
      actionsWei: MatchActionBNStr[];
    } = data.tradeDataMap[tradeByTargetAmount ? destAmount : srcAmount];

    let _srcAmount: string;
    let _destAmount: string;

    if (tradeByTargetAmount) {
      const maxInput = BigNumber(1)
        .plus(slippageBn)
        .times(BigNumber(tradeData.totalSourceAmount));

      encodedData = await toolkit.composeTradeByTargetTransaction(
        srcToken.toLowerCase(),
        destToken.toLowerCase(),
        tradeData.tradeActions,
        deadlineInMs,
        maxInput.toString(),
      );

      _srcAmount = maxInput
        .multipliedBy(BigNumber(10).pow(data.decimals[srcToken.toLowerCase()]))
        .minus(BigNumber(1))
        .toFixed(0);
      _destAmount = destAmount;
    } else {
      const minReturn = BigNumber(1)
        .minus(slippageBn)
        .times(BigNumber(tradeData.totalTargetAmount));

      encodedData = await toolkit.composeTradeBySourceTransaction(
        srcToken.toLowerCase(),
        destToken.toLowerCase(),
        tradeData.tradeActions,
        deadlineInMs,
        minReturn.toString(),
      );

      _srcAmount = srcAmount;
      _destAmount = minReturn
        .multipliedBy(BigNumber(10).pow(data.decimals[destToken.toLowerCase()]))
        .plus(BigNumber(1))
        .toFixed(0);
    }

    const simpleExchangeParam = this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      _srcAmount,
      destToken,
      _destAmount,
      encodedData.data || '',
      this.config.carbonController,
    );

    return simpleExchangeParam;
  }

  // This is called once before getTopPoolsForToken is
  // called for multiple tokens. This can be helpful to
  // update common state required for calculating
  // getTopPoolsForToken. It is optional for a DEX
  // to implement this
  async updatePoolState(): Promise<void> {}

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    if (!this.config.subgraphURL) return [];

    const _tokenAddress = tokenAddress.toLowerCase();

    const topPairsQuery = `
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
      topPairsQuery,
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

    const tokenDecimals: number =
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
          address: order.strategy.token1.id.toLowerCase(),
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
          address: order.strategy.token0.id.toLowerCase(),
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
