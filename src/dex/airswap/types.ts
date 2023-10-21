import { OrderERC20 } from '@airswap/types';

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
  swapErc20: string;
  makerRegistry: string;
};

export interface PriceLevel {
  threshold: number;
  price: number;
}

export type QuoteResponse = {
  maker: string;
  signedOrder: OrderERC20 | undefined;
};

export type PricingResponse = {
  maker: string;
  levels: PriceLevel[];
};
