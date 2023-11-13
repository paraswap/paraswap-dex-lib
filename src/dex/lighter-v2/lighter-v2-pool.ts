/* eslint-disable no-console */
import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Address, Log, Logger, Token } from '../../types';
import { bigIntify, catchParseLogError } from '../../utils';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { LimitOrder, OrderBook, PoolState } from './types';
import LighterV2OrderBookABI from '../../abi/lighter-v2/OrderBook.json';
import { ethers } from 'ethers';
import { BI_POWS } from '../../bigint-constants';

export class LighterV2EventPool extends StatefulEventSubscriber<PoolState> {
  handlers: {
    [event: string]: (
      event: any,
      state: DeepReadonly<PoolState>,
      log: Readonly<Log>,
    ) => DeepReadonly<PoolState> | null;
  } = {};

  logDecoder: (log: Log) => any;

  addressesSubscribed: string[];

  readonly orderBookInterface = new Interface(LighterV2OrderBookABI);
  readonly orderBookContract: ethers.Contract;

  constructor(
    readonly parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    readonly orderBookAddress: Address,
    readonly orderBookId: number,
    readonly token0: Token,
    readonly token1: Token,
    readonly sizeTick: bigint,
    readonly priceTick: bigint,
  ) {
    super(parentName, `${orderBookAddress}`, dexHelper, logger);
    this.logDecoder = (log: Log) => this.orderBookInterface.parseLog(log);
    this.addressesSubscribed = [orderBookAddress];

    this.orderBookContract = new ethers.Contract(
      this.orderBookAddress,
      this.orderBookInterface,
      this.dexHelper.provider,
    );

    // Add handlers
    this.handlers['CreateOrder'] = this.handleCreateOrder.bind(this);
    this.handlers['CancelLimitOrder'] = this.handleCancelLimitOrder.bind(this);
    this.handlers['Swap'] = this.handleSwap.bind(this);
  }

  async getOrders(blockNumber: number): Promise<OrderBook> {
    const batchSize = 1000;

    const paramsCalldata = [
      {
        target: this.orderBookAddress,
        callData: this.orderBookContract.interface.encodeFunctionData(
          'getPaginatedOrders',
          [0, true, batchSize],
        ),
      },
      {
        target: this.orderBookAddress,
        callData: this.orderBookContract.interface.encodeFunctionData(
          'getPaginatedOrders',
          [0, false, batchSize],
        ),
      },
    ];

    const paramsResults: ethers.utils.BytesLike[] = (
      await this.dexHelper.multiContract.methods
        .aggregate(paramsCalldata)
        .call({}, blockNumber)
    ).returnData;

    const [sortedAsks, sortedBids] = paramsResults
      .map(paramsResult => {
        return this.orderBookContract.interface.decodeFunctionResult(
          'getPaginatedOrders',
          paramsResult,
        );
      })
      .map(rawOrders => {
        const orders = [];
        const { isAsk, ids, amount0s, prices } = rawOrders[0];
        for (let i = 0; i < batchSize; i += 1) {
          if (ids[i] == 0) {
            break;
          }
          orders.push({
            isAsk: isAsk,
            id: ids[i],
            amount0: bigIntify(amount0s[i]),
            price: bigIntify(prices[i]),
          });
        }

        return orders;
      });

    return { sortedAsks, sortedBids };
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

  findOrder(id: number, state: DeepReadonly<PoolState>) {
    const askIndex = state.orderBook.sortedAsks.findIndex(o => o.id === id);
    const bidIndex = state.orderBook.sortedBids.findIndex(o => o.id === id);

    if (askIndex != -1) {
      return { isAsk: true, index: askIndex };
    } else if (bidIndex != -1) {
      return { isAsk: false, index: bidIndex };
    } else {
      return null;
    }
  }

  async initState(blockNumber: number): Promise<DeepReadonly<PoolState>> {
    const state = await this.generateState(blockNumber);
    this.setState(state, blockNumber);
    return state;
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
    const orderBook = await this.getOrders(blockNumber);

    return {
      sizeTick: this.sizeTick,
      priceTick: this.priceTick,
      token0: this.token0,
      token1: this.token1,
      pool: this.orderBookAddress,
      orderBook,
    };
  }

  handleCreateOrder(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    const base = bigIntify(event.args.amount0Base);
    const order: LimitOrder = {
      id: event.args.id,
      amount0: base * state.sizeTick,
      price: bigIntify(event.args.priceBase) * state.priceTick,
      isAsk: event.args.isAsk,
    };

    const sortedAsks = [...state.orderBook.sortedAsks];
    const sortedBids = [...state.orderBook.sortedBids];

    if (order.isAsk) {
      sortedAsks.push(order);
      sortedAsks.sort((a, b) => {
        const priceDifference = a.price - b.price;
        if (priceDifference == bigIntify(0)) {
          return Number(a.id - b.id); // lower id comes first
        } else {
          return priceDifference > bigIntify(0) ? +1 : -1;
        }
      });
    } else {
      sortedBids.push(order);
      sortedBids.sort((a, b) => {
        const priceDifference = b.price - a.price;
        if (priceDifference == bigIntify(0)) {
          return Number(a.id - b.id); // lower id comes first
        } else {
          return priceDifference > bigIntify(0) ? +1 : -1;
        }
      });
    }

    return {
      ...state,
      orderBook: {
        sortedAsks: sortedAsks,
        sortedBids: sortedBids,
      },
    };
  }

  handleCancelLimitOrder(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    const id = event.args.id;
    const sortedAsks = [...state.orderBook.sortedAsks];
    const sortedBids = [...state.orderBook.sortedBids];

    const order = this.findOrder(id, state);

    if (order == null) {
      console.error(`Could not find order with id ${id} to be canceled`);
      return null;
    }

    if (order.isAsk) {
      sortedAsks.splice(order.index, 1);
    } else {
      sortedBids.splice(order.index, 1);
    }

    return {
      ...state,
      orderBook: {
        sortedAsks: sortedAsks,
        sortedBids: sortedBids,
      },
    };
  }

  handleSwap(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    const askOrder = this.findOrder(event.args.askId, state);
    const bidOrder = this.findOrder(event.args.bidId, state);
    const amount0 = bigIntify(event.args.amount0);

    const sortedAsks = [...state.orderBook.sortedAsks];
    const sortedBids = [...state.orderBook.sortedBids];

    if (askOrder) {
      const index = askOrder.index;
      if (sortedAsks[index].amount0 === amount0) {
        sortedAsks.splice(askOrder.index, 1);
      } else {
        sortedAsks[index] = {
          ...sortedAsks[index],
          amount0: sortedAsks[index].amount0 - amount0,
        };
      }
    } else if (bidOrder) {
      const index = bidOrder.index;
      if (sortedBids[index].amount0 === amount0) {
        sortedBids.splice(index, 1);
      } else {
        sortedBids[index] = {
          ...sortedBids[index],
          amount0: sortedBids[index].amount0 - amount0,
        };
      }
    } else {
      console.error(
        `Could not find order with askId:${event.args.askId} or bidId:${event.args.bidId} to be canceled`,
      );
    }

    return {
      ...state,
      orderBook: {
        sortedAsks: sortedAsks,
        sortedBids: sortedBids,
      },
    };
  }

  getLockedAssets(state: DeepReadonly<PoolState>): {
    token0Amount: bigint;
    token1Amount: bigint;
  } {
    let token0Amount = 0n;
    let token1Amount = 0n;

    state.orderBook.sortedAsks.forEach(order => {
      token0Amount += order.amount0;
    });
    state.orderBook.sortedBids.forEach(order => {
      token1Amount +=
        (order.amount0 * order.price) / BI_POWS[state.token0.decimals];
    });

    return { token0Amount, token1Amount };
  }
}
