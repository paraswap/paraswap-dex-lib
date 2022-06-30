import { ethers } from 'ethers';
import { Interface } from '@ethersproject/abi';
import {
  Token,
  Address,
  ExchangePrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
  BigIntAsString,
  OptimalSwapExchange,
  ExchangeTxInfo,
  PreprocessTransactionOptions,
} from '../../types';
import { SwapSide, Network, LIMIT_ORDER_PROVIDERS } from '../../constants';
import { getBigIntPow, getDexKeysWithNetwork, wrapETH } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  ParaSwapLimitOrdersData,
  ParaSwapOrderResponse,
  ParaSwapLimitOrderPriceSummary,
  ParaSwapOrderBookResponse,
  OrderInfo,
  ParaSwapOrderBook,
} from './types';
import { ParaSwapLimitOrdersConfig, Adapters } from './config';
import { LimitOrderExchange } from '../limit-order-exchange';
import { BI_MAX_UINT } from '../../bigint-constants';
import augustusRFQABI from '../../abi/paraswap-limit-orders/AugustusRFQ.abi.json';
import { MAX_ORDERS_USED_FOR_SWAP, ONE_ORDER_GASCOST } from './constant';
import BigNumber from 'bignumber.js';
import { calcAmountThreshold } from './utils';

export class ParaSwapLimitOrders
  extends LimitOrderExchange<ParaSwapOrderResponse, ParaSwapOrderBookResponse>
  implements IDex<ParaSwapLimitOrdersData>
{
  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = true;
  readonly orderCosts = [...Array(MAX_ORDERS_USED_FOR_SWAP)].map((_0, index) =>
    BigInt((index + 1) * ONE_ORDER_GASCOST),
  );

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(ParaSwapLimitOrdersConfig);

  logger: Logger;

  constructor(
    protected network: Network,
    protected dexKey: string,
    protected dexHelper: IDexHelper,
    protected adapters = Adapters[network] ? Adapters[network] : {},
    protected augustusRFQAddress = ParaSwapLimitOrdersConfig[dexKey][
      network
    ].rfqAddress.toLowerCase(),
    protected rfqIface = new Interface(augustusRFQABI),
  ) {
    super(dexHelper.augustusAddress, dexHelper.provider);
    this.logger = dexHelper.getLogger(dexKey);
  }

  get limitOrderProviderName() {
    return LIMIT_ORDER_PROVIDERS.PARASWAP;
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  getIdentifier(srcToken: Address, destToken: Address) {
    // Expected lowered Addresses
    return `${this.dexKey.toLowerCase()}_${srcToken}_${destToken}`;
  }

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    if (side === SwapSide.BUY) return [];

    const _srcToken = wrapETH(srcToken, this.network);
    const _destToken = wrapETH(destToken, this.network);

    const _srcAddress = _srcToken.address.toLowerCase();
    const _destAddress = _destToken.address.toLowerCase();

    if (_srcAddress === _destAddress) {
      return [];
    }

    const orderBook = await this._getLatestOrderBook(_srcAddress, _destAddress);

    if (orderBook === null) return [];

    return [this.getIdentifier(_srcAddress, _destAddress)];
  }

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<ParaSwapLimitOrdersData>> {
    if (side === SwapSide.BUY) return null;

    try {
      const _srcToken = wrapETH(srcToken, this.network);
      const _destToken = wrapETH(destToken, this.network);

      const _srcAddress = _srcToken.address.toLowerCase();
      const _destAddress = _destToken.address.toLowerCase();

      if (_srcAddress === _destAddress) return null;

      const expectedIdentifier = this.getIdentifier(_srcAddress, _destAddress);

      if (
        limitPools !== undefined &&
        !limitPools.some(p => p === expectedIdentifier)
      )
        return null;

      const unitVolume = getBigIntPow(_srcToken.decimals);

      const _amounts = [unitVolume, ...amounts.slice(1)];

      let orderBook = await this._getLatestOrderBook(_srcAddress, _destAddress);

      if (orderBook === null) return null;

      // Unit is volume is not increasing, so better to request separate
      const unitPriceSummary = this._getPriceSummaries(
        [unitVolume],
        orderBook,
        side,
      );

      const priceSummaries = unitPriceSummary.concat(
        this._getPriceSummaries(amounts.slice(1), orderBook, side),
      );

      const { prices: _prices, costs: gasCosts } = this._getPrices(
        _amounts,
        priceSummaries,
      );

      const unit = _prices[0];
      gasCosts[0] = 0n;

      return [
        {
          unit,
          prices: [0n, ..._prices.slice(1)],
          data: { orderInfos: null },
          poolIdentifier: expectedIdentifier,
          exchange: this.dexKey,
          gasCost: gasCosts.map(v => Number(v)),
          poolAddresses: [this.augustusRFQAddress],
        },
      ];
    } catch (e) {
      this.logger.error(
        `Error_getPricesVolume ${this.dexKey}: ${
          srcToken.symbol || srcToken.address
        }, ${destToken.symbol || destToken.address}, ${side}:`,
        e,
      );
      return null;
    }
  }

  async preProcessTransaction?(
    optimalSwapExchange: OptimalSwapExchange<ParaSwapLimitOrdersData>,
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    options: PreprocessTransactionOptions,
  ): Promise<[OptimalSwapExchange<ParaSwapLimitOrdersData>, ExchangeTxInfo]> {
    const userAddress = options.txOrigin;

    const srcWrapped = wrapETH(srcToken, this.network).address.toLowerCase();
    const destWrapped = wrapETH(destToken, this.network).address.toLowerCase();

    const destAmountWithSlippage = BigInt(
      new BigNumber(optimalSwapExchange.destAmount.toString())
        .times(options.slippageFactor)
        .toFixed(0),
    );

    const { encodingValues, minDeadline } =
      await this._prepareOrdersForTransaction(
        srcWrapped,
        destWrapped,
        optimalSwapExchange.srcAmount,
        destAmountWithSlippage.toString(),
        side,
        userAddress,
      );

    return [
      {
        ...optimalSwapExchange,
        data: { orderInfos: encodingValues },
      },
      { deadline: minDeadline },
    ];
  }

  getTokenFromAddress?(address: Address): Token {
    // We don't have predefined set of tokens with decimals
    // Anyway we don't use decimals, so it is fine to do this
    return { address, decimals: 0 };
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: ParaSwapLimitOrdersData,
    side: SwapSide,
  ): AdapterExchangeParam {
    if (side === SwapSide.BUY) throw new Error(`Buy not supported`);

    const { orderInfos } = data;

    if (orderInfos === null) {
      throw new Error(
        `Error_${this.dexKey}_getAdapterParam payload is not received. It may be because of` +
          `not calling preProcessTransaction before`,
      );
    }

    const orderInfoParamType = this.rfqIface.getFunction(
      'tryBatchFillOrderTakerAmount',
    ).inputs[0];

    const orderInfoTypes = orderInfoParamType.format(
      ethers.utils.FormatTypes.full,
    );

    const payload = this.rfqIface._abiCoder.encode(
      [`tuple(${orderInfoTypes})`],
      [{ orderInfos }],
    );

    return {
      targetExchange: this.augustusRFQAddress,
      payload,
      networkFee: '0',
    };
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: ParaSwapLimitOrdersData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    if (side === SwapSide.BUY) throw new Error(`Buy not supported`);

    const { orderInfos } = data;

    if (orderInfos === null) {
      throw new Error(
        `Error_${this.dexKey}_getAdapterParam payload is not received. It may be because of` +
          `not calling preProcessTransaction before`,
      );
    }

    const swapData = this.rfqIface.encodeFunctionData(
      'tryBatchFillOrderTakerAmount',
      [orderInfos, srcAmount, this.augustusAddress],
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      this.augustusRFQAddress,
    );
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    return [];
  }

  private async _getLatestOrderBook(
    src: Address,
    dest: Address,
  ): Promise<ParaSwapOrderBook[] | null> {
    const orderBookUnparsed = await this._limitOrderProvider!.fetchOrderBook(
      this.network,
      src,
      dest,
    );

    if (orderBookUnparsed === null || orderBookUnparsed.length === 0) {
      this.logger.trace(
        `${this.dexKey}: No orderBook found for ${src} and ${dest} on ${this.network} network`,
      );
      return null;
    }

    return orderBookUnparsed
      .map(orderBook => ({
        swappableMakerBalance: BigInt(orderBook.swappableMakerBalance),
        swappableTakerBalance: BigInt(orderBook.swappableTakerBalance),
      }))
      .filter(
        orderBook =>
          orderBook.swappableMakerBalance > 0n &&
          orderBook.swappableTakerBalance > 0n,
      );
  }

  private async _prepareOrdersForTransaction(
    srcToken: Address,
    destToken: Address,
    srcAmount: BigIntAsString,
    destAmount: BigIntAsString,
    side: SwapSide,
    userAddress: Address,
  ): Promise<{
    encodingValues: OrderInfo[];
    minDeadline: bigint;
  }> {
    // I assume that srcToken and destToken are already wrapped
    // And received orders are fully match the amount we need and the price
    // without further checks and calculations
    const orderInfos = await this._limitOrderProvider!.fetchAndReserveOrders(
      this.network,
      srcToken,
      destToken,
      srcAmount,
      destAmount,
      side,
      userAddress,
    );

    if (orderInfos === null)
      throw new Error(
        `${
          this.dexKey
        }: No orders received from _limitOrderProvider fetchAndReserveOrders request with params: ${JSON.stringify(
          {
            network: this.network,
            srcToken,
            destToken,
            srcAmount,
            destAmount,
            side,
            userAddress,
          },
        )}`,
      );

    const encodingValues: OrderInfo[] = new Array(orderInfos.length);

    let minDeadline = BI_MAX_UINT;
    for (const [i, orderInfo] of orderInfos.entries()) {
      // Find minimum deadline value
      const { order } = orderInfo;

      const orderExpiryBigInt = BigInt(order.expiry);
      minDeadline =
        orderExpiryBigInt < minDeadline ? orderExpiryBigInt : minDeadline;

      encodingValues[i] = {
        order: {
          nonceAndMeta: order.nonceAndMeta,
          expiry: order.expiry,
          makerAsset: order.makerAsset,
          takerAsset: order.takerAsset,
          maker: order.maker,
          taker: order.taker,
          makerAmount: order.makerAmount,
          takerAmount: order.takerAmount,
        },
        signature: orderInfo.signature,
        takerTokenFillAmount: orderInfo.takerTokenFillAmount,
        permitTakerAsset: orderInfo.permitTakerAsset
          ? orderInfo.permitTakerAsset
          : '0x',
        permitMakerAsset: orderInfo.permitMakerAsset
          ? orderInfo.permitMakerAsset
          : '0x',
      };
    }
    return { encodingValues, minDeadline };
  }

  private _getPrices(
    amounts: bigint[],
    priceSummaries: ParaSwapLimitOrderPriceSummary[][],
  ): { prices: bigint[]; costs: bigint[] } {
    const prices = new Array<bigint>(amounts.length);
    const costs = new Array<bigint>(amounts.length);

    for (let j = 0; j < amounts.length; j++) {
      const priceSummary = priceSummaries[j];

      let i = 0;
      while (
        i < priceSummary.length &&
        amounts[j] > priceSummary[i].cumulativeTakerAmount
      )
        i++;

      if (i === 0) {
        prices[j] =
          (priceSummary[i].cumulativeMakerAmount * amounts[j]) /
          priceSummary[i].cumulativeTakerAmount;
        costs[j] = this.orderCosts[i];
      } else if (i < priceSummary.length) {
        prices[j] =
          priceSummary[i - 1].cumulativeMakerAmount +
          ((priceSummary[i].cumulativeMakerAmount -
            priceSummary[i - 1].cumulativeMakerAmount) *
            (amounts[j] - priceSummary[i - 1].cumulativeTakerAmount)) /
            (priceSummary[i].cumulativeTakerAmount -
              priceSummary[i - 1].cumulativeTakerAmount);
        costs[j] = this.orderCosts[i];
      } else {
        prices[j] = 0n;
        costs[j] = 0n;
      }
    }
    return { prices, costs };
  }

  private _getPriceSummaries(
    amounts: bigint[],
    orderBook: ParaSwapOrderBook[],
    side: SwapSide,
  ): ParaSwapLimitOrderPriceSummary[][] {
    let latestFilteredOrderBook = orderBook;

    return amounts.map(amount => {
      const amountThreshold = calcAmountThreshold(amount);

      latestFilteredOrderBook = latestFilteredOrderBook.filter(
        ob => ob.swappableTakerBalance >= amountThreshold,
      );

      const priceSummary: ParaSwapLimitOrderPriceSummary[] = new Array(
        Number(MAX_ORDERS_USED_FOR_SWAP),
      );

      let counter = 0;
      for (const order of latestFilteredOrderBook) {
        if (counter < MAX_ORDERS_USED_FOR_SWAP) {
          const isCounterZero = counter === 0;
          priceSummary[counter] = {
            cumulativeMakerAmount: isCounterZero
              ? order.swappableMakerBalance
              : priceSummary[counter - 1].cumulativeMakerAmount +
                order.swappableMakerBalance,
            cumulativeTakerAmount: isCounterZero
              ? order.swappableTakerBalance
              : priceSummary[counter - 1].cumulativeTakerAmount +
                order.swappableTakerBalance,
          };
          counter++;
        } else {
          break;
        }
      }
      return priceSummary;
    });
  }
}
