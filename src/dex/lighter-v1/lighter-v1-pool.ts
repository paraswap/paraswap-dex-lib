import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Address, Log, Logger, Token } from '../../types';
import { bigIntify, catchParseLogError } from '../../utils';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { LimitOrder, OrderBook, OrderBookDetails, PoolState } from './types';
import LighterV1OrderBookIface from './abi/order_book.json';
import LighterV1OrderBookHelperIface from './abi/order_book_helper.json';
import LighterV1FactoryIface from './abi/factory.json';
import LighterV1RouterIface from './abi/router.json';
import Erc20Iface from './abi/erc20.json';
import { Contract, ethers } from 'ethers';
import BigNumber from 'bignumber.js';
import { replaceTokenSymbol, stablecoins } from './constants';

export class LighterV1EventPool extends StatefulEventSubscriber<PoolState> {
  handlers: {
    [event: string]: (
      event: any,
      state: DeepReadonly<PoolState>,
      log: Readonly<Log>,
    ) => DeepReadonly<PoolState> | null;
  } = {};

  logDecoder: (log: Log) => any;

  private baseToken: Token;
  private quoteToken: Token;
  private orderBookId: number;
  private sizeTick: bigint;

  public readonly orderBookAddress: Address;

  public readonly orderBookIface = new Interface(LighterV1OrderBookIface);
  public readonly orderBookHelperIface = new Interface(
    LighterV1OrderBookHelperIface,
  );
  public readonly factoryIface = new Interface(LighterV1FactoryIface);
  public readonly routerIface = new Interface(LighterV1RouterIface);
  public readonly erc20Iface = new Interface(Erc20Iface);

  addressesSubscribed: string[];

  constructor(
    readonly parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    protected readonly factoryAddress: Address,
    protected readonly routerAddress: Address,
    orderBookId: number,
    orderBookAddress: Address,
    baseToken: Token,
    quoteToken: Token,
    sizeTick: bigint,
  ) {
    super(
      parentName,
      `${baseToken.address}_${quoteToken.address}`,
      dexHelper,
      logger,
    );

    this.logDecoder = (log: Log) => this.orderBookIface.parseLog(log);
    this.addressesSubscribed = new Array<Address>(1);
    this.addressesSubscribed[0] = orderBookAddress;

    this.baseToken = baseToken;
    this.quoteToken = quoteToken;
    this.orderBookId = orderBookId;
    this.sizeTick = sizeTick;
    this.orderBookAddress = orderBookAddress;

    // Add handlers
    this.handlers['LimitOrderCreated'] =
      this.handleLimitOrderCreatedEvent.bind(this);
    this.handlers['LimitOrderCanceled'] =
      this.handleLimitOrderCanceledEvent.bind(this);
    this.handlers['Swap'] = this.handleSwapEvent.bind(this);
  }

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
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    try {
      const event = this.logDecoder(log);
      if (event.name in this.handlers) {
        return this.handlers[event.name](event, state, log);
      }
    } catch (e) {
      catchParseLogError(e, this.logger);
    }

    return null;
  }

  // TODO: this might be called from v1
  async getOrderBookDetailsFromTokenPair(
    token0: Address,
    token1: Address,
  ): Promise<OrderBookDetails> {
    const factory = new ethers.Contract(this.factoryAddress, this.factoryIface);
    const result = await factory.getOrderBookDetailsFromTokenPair(
      token0,
      token1,
    );

    return {
      orderBookId: result[0],
      orderBookAddress: result[1],
      token0Address: result[2],
      token1Address: result[3],
      sizeTick: result[4],
      priceTick: result[5],
    };
  }

  private _getPrice(
    baseAmount: bigint,
    quoteAmount: bigint,
    powBase: bigint,
    powQuote: bigint,
  ): number {
    // Convert BigInt to BigNumber
    let baseAmountBN = new BigNumber(baseAmount.toString());
    let quoteAmountBN = new BigNumber(quoteAmount.toString());
    let powBaseBN = new BigNumber(powBase.toString());
    let powQuoteBN = new BigNumber(powQuote.toString());

    // Perform the calculation
    let priceRat = quoteAmountBN
      .times(powBaseBN)
      .dividedBy(baseAmountBN)
      .dividedBy(powQuoteBN);

    // Convert the result to a number and return it
    let price: number = priceRat.toNumber();

    return price;
  }

  async getOrderBook(blockNumber: number): Promise<OrderBook> {
    const router = new ethers.Contract(this.routerAddress, this.routerIface);

    const currentBlockNumber = await this.dexHelper.provider.getBlockNumber();

    if (currentBlockNumber < blockNumber) {
      blockNumber = currentBlockNumber;
    }

    const data = await this.dexHelper.provider.call(
      {
        to: router.address,
        data: router.interface.encodeFunctionData('getLimitOrders', [
          Number(this.orderBookId),
        ]),
      },
      blockNumber,
    );

    const result = router.interface.decodeFunctionResult(
      'getLimitOrders',
      data,
    );

    const [ids, _, amounts0, amounts1, isAsks] = result;

    const orders: LimitOrder[] = ids.map((id: bigint, index: number) => ({
      id: id,
      amount0: bigIntify(amounts0[index]),
      amount1: bigIntify(amounts1[index]),
      isAsk: isAsks[index],
      price: this._getPrice(
        bigIntify(amounts0[index]),
        bigIntify(amounts1[index]),
        10n ** bigIntify(this.baseToken.decimals),
        10n ** bigIntify(this.quoteToken.decimals),
      ),
    }));

    const asks: Record<number, LimitOrder> = {};
    const bids: Record<number, LimitOrder> = {};

    orders.forEach(order => {
      if (order.isAsk) {
        asks[Number(order.id)] = order;
      } else {
        bids[Number(order.id)] = order;
      }
    });

    const sortedAsks = Object.values(asks).sort((a, b) => {
      const priceDifference = Number(a.price - b.price);
      if (priceDifference === 0) {
        return Number(a.id - b.id); // lower id comes first
      } else {
        return priceDifference;
      }
    });

    const sortedBids = Object.values(bids).sort((a, b) => {
      const priceDifference = Number(b.price - a.price);
      if (priceDifference === 0) {
        return Number(a.id - b.id); // lower id comes first
      } else {
        return priceDifference;
      }
    });

    const orderBook: OrderBook = {
      sortedAsks: sortedAsks,
      sortedBids: sortedBids,
    };

    return orderBook;
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
  async generateState(blockNumber: number): Promise<DeepReadonly<PoolState>> {
    const orderBook = await this.getOrderBook(blockNumber);

    return {
      pool: this.orderBookAddress,
      baseToken: this.baseToken,
      quoteToken: this.quoteToken,
      orderBook: orderBook,
      sizeTick: this.sizeTick,
    };
  }

  handleLimitOrderCreatedEvent(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    const order: LimitOrder = {
      id: event.args.id,
      amount0: bigIntify(event.args.amount0),
      amount1: bigIntify(event.args.amount1),
      isAsk: event.args.isAsk,
      price: this._getPrice(
        bigIntify(event.args.amount0),
        bigIntify(event.args.amount1),
        10n ** bigIntify(this.baseToken.decimals),
        10n ** bigIntify(this.quoteToken.decimals),
      ),
    };

    const sortedAsks = [...state.orderBook.sortedAsks];
    const sortedBids = [...state.orderBook.sortedBids];

    if (order.isAsk) {
      sortedAsks.push(order);
      sortedAsks.sort((a, b) => {
        const priceDifference = Number(a.price - b.price);
        if (priceDifference === 0) {
          return Number(a.id - b.id); // lower id comes first
        } else {
          return priceDifference;
        }
      });
    } else {
      sortedBids.push(order);
      sortedBids.sort((a, b) => {
        const priceDifference = Number(b.price - a.price);
        if (priceDifference === 0) {
          return Number(a.id - b.id); // lower id comes first
        } else {
          return priceDifference;
        }
      });
    }

    const orderBook: OrderBook = {
      sortedAsks: sortedAsks,
      sortedBids: sortedBids,
    };

    return {
      ...state,
      orderBook: orderBook,
    };
  }

  handleLimitOrderCanceledEvent(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    const order: LimitOrder = {
      id: event.args.id,
      amount0: event.args.amount0,
      amount1: event.args.amount1,
      isAsk: event.args.isAsk,
      price: this._getPrice(
        bigIntify(event.args.amount0),
        bigIntify(event.args.amount1),
        10n ** bigIntify(this.baseToken.decimals),
        10n ** bigIntify(this.quoteToken.decimals),
      ),
    };

    const sortedAsks = [...state.orderBook.sortedAsks];
    const sortedBids = [...state.orderBook.sortedBids];

    if (order.isAsk) {
      sortedAsks.splice(
        sortedAsks.findIndex(o => o.id === order.id),
        1,
      );
    } else {
      sortedBids.splice(
        sortedBids.findIndex(o => o.id === order.id),
        1,
      );
    }

    const orderBook: OrderBook = {
      sortedAsks: sortedAsks,
      sortedBids: sortedBids,
    };

    return {
      ...state,
      orderBook: orderBook,
    };
  }

  handleSwapEvent(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    const askOrder: LimitOrder | undefined = state.orderBook.sortedAsks.find(
      o => o.id === Number(event.args.askId),
    );

    const bidOrder: LimitOrder | undefined = state.orderBook.sortedBids.find(
      o => o.id === Number(event.args.bidId),
    );

    const sortedAsks = [...state.orderBook.sortedAsks];
    const sortedBids = [...state.orderBook.sortedBids];

    if (askOrder && askOrder.amount0 === event.args.amount0) {
      sortedAsks.splice(
        sortedAsks.findIndex(o => o.id === event.args.askId),
        1,
      );
    } else if (askOrder) {
      sortedAsks.splice(
        sortedAsks.findIndex(o => o.id === event.args.askId),
        1,
        {
          ...askOrder,
          amount0: askOrder.amount0 - bigIntify(event.args.amount0),
          amount1: askOrder.amount1 - bigIntify(event.args.amount1),
        },
      );
    }

    if (bidOrder && bidOrder.amount1 === event.args.amount1) {
      sortedBids.splice(
        sortedBids.findIndex(o => o.id === event.args.bidId),
        1,
      );
    } else if (bidOrder) {
      sortedBids.splice(
        sortedBids.findIndex(o => o.id === event.args.bidId),
        1,
        {
          ...bidOrder,
          amount0: bidOrder.amount0 - bigIntify(event.args.amount0),
          amount1: bidOrder.amount1 - bigIntify(event.args.amount1),
        },
      );
    }

    const orderBook: OrderBook = {
      sortedAsks: sortedAsks,
      sortedBids: sortedBids,
    };

    return {
      ...state,
      orderBook: orderBook,
    };
  }

  async getTokenPrice(tokenSymbol?: string): Promise<number> {
    if (!tokenSymbol) {
      return 0;
    }

    if (stablecoins.includes(tokenSymbol)) {
      return 1;
    }

    tokenSymbol = replaceTokenSymbol(tokenSymbol);

    const url = `https://api.binance.com/api/v3/ticker/price?symbol=${tokenSymbol}USDT`;

    let response: any;
    try {
      response = await this.dexHelper.httpRequest.get(url);
    } catch (e) {
      return 0;
    }

    return parseFloat(response.price);
  }

  async calculateLiquidity(): Promise<number> {
    const token0Price = await this.getTokenPrice(this.baseToken.symbol);
    const token1Price = await this.getTokenPrice(this.quoteToken.symbol);

    let liquidity = 0;

    const state = this.getState(this.stateBlockNumber);

    if (!state) {
      return 0;
    }

    for (const ask of state.orderBook.sortedAsks) {
      let baseAmount = new BigNumber(ask.amount0.toString());
      let powDecimals = new BigNumber(
        (10n ** bigIntify(this.baseToken.decimals)).toString(),
      );

      const amount0 = baseAmount.dividedBy(powDecimals).toNumber();
      liquidity += amount0 * token0Price;
    }

    for (const bid of state.orderBook.sortedBids) {
      let quoteAmount = new BigNumber(bid.amount1.toString());
      let powDecimals = new BigNumber(
        (10n ** bigIntify(this.quoteToken.decimals)).toString(),
      );
      const amount1 = quoteAmount.dividedBy(powDecimals).toNumber();
      liquidity += amount1 * token1Price;
    }

    return liquidity;
  }
}
