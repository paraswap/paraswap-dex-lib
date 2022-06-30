import { Address, BigIntAsString, Token } from '../../types';

export type PoolState = {
  srcToken: Token;
  destToken: Token;
  amount: bigint;
  price: bigint;
};

export type AugustusOrder = {
  nonceAndMeta: bigint;
  expiry: number;
  makerAsset: Address;
  takerAsset: Address;
  maker: Address;
  taker: Address;
  makerAmount: bigint;
  takerAmount: bigint;
};

export type ParaSwapLimitOrderPriceSummary = {
  cumulativeMakerAmount: bigint;
  cumulativeTakerAmount: bigint;
};

export type ParaSwapOrderBookResponse = {
  makerBalance: BigIntAsString;
  takerBalance: BigIntAsString;
};

export type ParaSwapOrderBook = {
  makerBalance: bigint;
  takerBalance: bigint;
};

export type ParaSwapLimitOrdersData = {
  orderInfos: OrderInfo[] | null;
};

export type DexParams = {
  rfqAddress: string;
};

export type OrderInfo = {
  order: Omit<
    AugustusOrder,
    'nonceAndMeta' | 'makerAmount' | 'takerAmount' | 'expiry'
  > & {
    expiry: string;
    nonceAndMeta: BigIntAsString;
    makerAmount: BigIntAsString;
    takerAmount: BigIntAsString;
  };
  signature: string;
  takerTokenFillAmount: BigIntAsString;
  permitTakerAsset: string;
  permitMakerAsset: string;
};

export type ParaSwapOrderResponse = OrderInfo;
