import { Address } from '../../types';
import { Order } from '@airswap/typescript';

export type PoolState = {
  // TODO: poolState is the state of event
  // subscriber. This should be the minimum
  // set of parameters required to compute
  // pool prices. Complete me!
};

export type AirswapData = {
  maker: string;
  signedOrder: Order;
};

export type DexParams = {
  swapERC20: string;
  makerRegistry: string;
};

export interface PriceLevel {
  level: string;
  price: string;
}
