import { Address, Token } from '../../types';

export type PoolState = {
  token0: Token;
  token1: Token;
  sizeTick: bigint;
  priceTick: bigint;
  pool: Address;
  orderBook: OrderBook;
};

export type OrderBook = {
  sortedAsks: LimitOrder[];
  sortedBids: LimitOrder[];
};

export type LimitOrder = {
  id: number;
  amount0: bigint;
  price: bigint;
  isAsk: boolean;
};

export type LighterV2Data = {
  orderBookId: number;
  isAsk: boolean;
  exchange: Address;
};

export type DexParams = {
  factory: string;
  router: string;
};
