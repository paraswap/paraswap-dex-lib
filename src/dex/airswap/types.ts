import { OrderERC20 } from '@airswap/types';

export type AirswapData = {
  maker: string;
  senderWallet: string;
  signedOrder: OrderERC20;
};

export type DexParams = {};

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
