import { QuoteData } from '@hashflow/taker-js/dist/types/common';

export type HashflowData = {
  mm: string;
  quoteData?: QuoteData;
  signature?: string;
  gasEstimate?: number;
};

export type DexParams = {
  routerAddress: string;
};

export interface PriceLevel {
  level: string;
  price: string;
}

export class RfqError extends Error {}

export enum RFQType {
  RFQT = 0,
  RFQM = 1,
}
