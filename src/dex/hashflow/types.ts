import { QuoteData } from '@hashflow/taker-js/dist/types/common';
import { Address } from '../../types';

export type PoolState = {
  // TODO: poolState is the state of event
  // subscriber. This should be the minimum
  // set of parameters required to compute
  // pool prices. Complete me!
};

export type HashflowData = {
  quoteData: QuoteData;
  signature: string;
  gasEstimate: number;
};

export type DexParams = {
  // TODO: DexParams is set of parameters the can
  // be used to initiate a DEX fork.
  // Complete me!
};

export interface PriceLevel {
  level: string;
  price: string;
}

export class RfqError extends Error {}
