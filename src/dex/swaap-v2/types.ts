import { RequestHeaders } from '../../dex-helper';
import { Method } from '../../dex-helper/irequest-wrapper';
import { Token } from '../../types';

export type SwaapV2Data = {
  router: string;
  callData: string;
};

export type DexParams = {};

export class SwaapV2QuoteError extends Error {}

export interface SwaapV2PriceLevel {
  level: number;
  price: number;
}

export type SwaapV2PriceLevels = {
  bids: Array<SwaapV2PriceLevel>;
  asks: Array<SwaapV2PriceLevel>;
  quote: string;
  base: string;
};

export type SwaapV2PriceLevelsResponse = {
  levels: Record<string, SwaapV2PriceLevels>;
  success: boolean;
};

export type SwaapV2RateFetcherConfig = {
  rateConfig: {
    pricesReqParams: SwaapV2APIParameters;
    pricesIntervalMs: number;
    pricesCacheTTLSecs: number;
  };
};

export type SwaapV2TokensResponse = {
  tokens: {
    [address: string]: {
      symbol: string;
      address: string;
      decimals: number;
    },
  },
  success: boolean;
}

export type SwaapV2QuoteResponse = {
  id: string;
  calldata: string;
  router: string;
  expiration: number;
  amount: string;
  recipient: string;
  guaranteed_price: number;
  success: boolean;
};

export declare enum SwaapV2OrderType {
  SELL = 1,
  BUY = 2,
}

export type SwaapV2QuoteRequest = {
  network_id: number;
  origin: string;
  sender: string;
  recipient: string;
  timestamp: number;
  order_type: SwaapV2OrderType;
  token_in: string;
  token_out: string;
  amount: string;
  tolerance: number;
};

export type SwaapV2APIParameters = {
  url: string;
  headers?: RequestHeaders;
  params?: any;
  method?: Method;
};

export type TokensMap = {
  [address: string]: Token,
};
