import { QuoteData } from '@hashflow/taker-js/dist/types/common';
import { RequestHeaders } from '../../dex-helper';

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

export class SlippageCheckError extends Error {}

export type HashflowRatesLevel = {
  pair: Record<string, string>;
  levels: Array<Record<string, string>>;
  includesFees: boolean;
};

export type HashflowMarketMakersResponse = {
  marketMakers: string[];
};

export type HashflowRatesResponse = {
  status: string;
  networkId: string;
  levels: Record<string, Array<HashflowRatesLevel>>
};

export type HashflowRateFetcherConfig = {
  rateConfig: {
    marketMakersReqParams: {
      url: string;
      headers?: RequestHeaders;
      params?: any;
    }
    pricesReqParams: {
      url: string;
      headers?: RequestHeaders;
      params?: any;
    },
    intervalMs: number;
    filterMarketMakers: (makers: string[]) => Promise<string[]>;
    pricesCacheKey: string;
    marketMakersCacheKey: string;
    pricesCacheTTLSecs: number;
    marketMakersCacheTTLSecs: number;
  },
};
