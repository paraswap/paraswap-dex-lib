import { Address, Token } from '../../types';

export type PoolState = {
  pool: Address;
  baseToken: Token;
  quoteToken: Token;
  orderBook: OrderBook;
  sizeTick: bigint;
};

export type OrderBook = {
  sortedAsks: LimitOrder[];
  sortedBids: LimitOrder[];
};

export type LighterV1Data = {
  // TODO: LighterV1Data is the dex data that is
  // returned by the API that can be used for
  // tx building. The data structure should be minimal.
  // Complete me!
  exchange: Address;
};

export type DexParams = {
  // TODO: DexParams is set of parameters the can
  // be used to initiate a DEX fork.
  // Complete me!
  factory: Address;
  router: Address;
  orderBookHelper: Address;
};

export type OrderBookDetails = {
  orderBookId: number;
  orderBookAddress: string;
  token0Address: string;
  token1Address: string;
  sizeTick: number;
  priceTick: number;
};

export type LimitOrder = {
  id: number;
  amount0: bigint;
  amount1: bigint;
  isAsk: boolean;
  price: number;
};

export type OrderBookType = {
  orderBookId: number;
  isAsk: boolean;
};

export type AllOrderBooks = Map<string, OrderBookType>;
