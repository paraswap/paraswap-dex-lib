import { OrderERC20 } from '@airswap/typescript';

export type PoolState = {
  // TODO: poolState is the state of event
  // subscriber. This should be the minimum
  // set of parameters required to compute
  // pool prices. Complete me!
};

export type AirswapData = {
  maker: string;
  senderWallet: string;
  signedOrder: OrderERC20;
};

export type DexParams = {
  swap: string;
  makerRegistry: string;
};

export interface PriceLevel {
  level: string;
  price: string;
}

export type QuoteResponse = {
  maker: string;
  signedOrder: OrderERC20;
};
