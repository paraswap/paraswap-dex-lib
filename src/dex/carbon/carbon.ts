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
import { SwapSide, Network } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { CarbonData } from './types';
import { SimpleExchange } from '../simple-exchange';
import { CarbonConfig, Adapters } from './config';
import { CarbonEventPool } from './carbon-pool';
import { BN_0, BN_1, getBigNumberPow } from '../../bignumber-constants';

import {
  BigNumber,
  Decimal,
  mulDiv,
  tenPow,
  formatUnits,
  parseUnits,
} from '@bancor/carbon-sdk/utils';

export class Carbon extends SimpleExchange implements IDex<CarbonData> {
  protected eventPools: CarbonEventPool;

  readonly hasConstantPriceLargeAmounts = false;
  // TODO: set true here if protocols works only with wrapped asset
  readonly needWrapNative = true;

  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(CarbonConfig);

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {}, // TODO: add any additional optional params to support other fork DEXes
    protected config = CarbonConfig[dexKey][network],
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    this.eventPools = new CarbonEventPool(
      dexKey,
      network,
      dexHelper,
      this.logger,
    );
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    // TODO: complete me!
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
    // TODO: complete me!
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
  ): Promise<null | ExchangePrices<CarbonData>> {
    // TODO: complete me!
    return null;
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
    data: CarbonData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    // TODO: complete me!
    const { exchange } = data;

    // Encode here the transaction arguments
    const swapData = '';

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
    query ($token: Bytes!, $count: Int)) {
      orders0: orders(first: $count, orderBy: y, orderDirection: desc, where: {type: "order0", strategy_: {token0: $token}}) {
        pair {
          id
        }
        strategy {
          id
          token0 {
            decimals
          }
        }
        y
      }
      orders1: orders(first: $count, orderBy: y, orderDirection: desc, where: {type: "order1", strategy_: {token1: $token}}) {
        pair {
          id
        }
        strategy {
          id
          token1 {
            decimals
          }
        }
        y
      }
    }
    `;

    const data = await this._querySubgraph(query, {
      token: _tokenAddress,
      count: limit,
    });

    if (!(data && data.orders0 && data.orders1)) {
      this.logger.error(
        `Error_${this.dexKey}_Subgraph: couldn't fetch the orders from the subgraph`,
      );
      return [];
    }

    let tokenDecimals: number = data.orders0[0].strategy.token0.decimals;

    const tokenPriceUsd = await this.dexHelper.getTokenUSDPrice(
      {
        address: _tokenAddress,
        decimals: tokenDecimals,
      },
      BigInt(getBigNumberPow(tokenDecimals).toFixed(0)),
    );

    const orders0 = _.map(data.orders0, order => ({
      exchange: this.dexKey,
      address: order.strategy.id,
      connectorTokens: [
        {
          address: order.pair.id.split('-')[0],
          decimals: tokenDecimals,
        },
      ],
      liquidityUSD:
        Number(formatUnits(BigInt(order.y), tokenDecimals)) * tokenPriceUsd,
    }));

    const orders1 = _.map(data.orders1, order => ({
      exchange: this.dexKey,
      address: order.strategy.id,
      connectorTokens: [
        {
          address: order.pair.id.split('-')[1],
          decimals: tokenDecimals,
        },
      ],
      liquidityUSD:
        Number(formatUnits(BigInt(order.y), tokenDecimals)) * tokenPriceUsd,
    }));

    const orders = _.slice(
      _.sortBy(_.concat(orders0, orders1), [order => -1 * order.liquidityUSD]),
      0,
      limit,
    );

    return orders;
  }

  private async _querySubgraph(
    query: string,
    variables: Object,
    timeout = 30000,
  ) {
    try {
      const res = await this.dexHelper.httpRequest.post(
        this.config.subgraphURL,
        { query, variables },
        undefined,
        { timeout: timeout },
      );
      return res.data;
    } catch (e) {
      this.logger.error(`${this.dexKey}: can not query subgraph: `, e);
      return {};
    }
  }

  // This is optional function in case if your implementation has acquired any resources
  // you need to release for graceful shutdown. For example, it may be any interval timer
  releaseResources(): AsyncOrSync<void> {
    // TODO: complete me!
  }
}
