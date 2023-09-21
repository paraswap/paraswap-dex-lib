import { RequestHeaders } from '../../dex-helper';
import { Method } from '../../dex-helper/irequest-wrapper';
import { Token } from '../../types';

export type NativeData = {
  from: string;
  to: string;
  struct: any;
  calldata: string;
};

export type DexParams = {
  routerAddress: string;
};

export type NativeRatesResponse = Array<{
  base_symbol: string;
  base_address: string;
  quote_symbol: string;
  quote_address: string;
  levels: Array<[number, number]>;
  side: 'ask' | 'bid';
  minimum_in_base: number;
}>;

export type NativeTokensResponse = Array<{
  address: string;
  symbol: string;
  decimals: number;
}>;

export interface NativePriceLevel {
  level: number;
  price: number;
}

export type NativePriceLevels = {
  bids: Array<NativePriceLevel>;
  asks: Array<NativePriceLevel>;
  quote: string;
  base: string;
};

export type NativeRateFetcherConfig = {
  rateConfig: {
    pricesReqParams: NativeAPIParameters;
    pricesIntervalMs: number;
    pricesCacheTTLSecs: number;
    pricesCacheKey: string;
  };
  tokensConfig: {
    tokensReqParams: NativeAPIParameters;
    tokensIntervalMs: number;
    tokensCacheTTLSecs: number;
    tokensCacheKey: string;
  };
};

export type NativeAPIParameters = {
  url: string;
  headers?: RequestHeaders;
  params?: any;
  method?: Method;
};

export type TokensMap = {
  [address: string]: Token;
};

export declare enum NativeOrderType {
  SELL = 1,
  BUY = 2,
}

export type NativeQuoteResponse = {
  from: string;
  to: string;
  struct: any;
  calldata: string;
};

export type NativeQuoteRequest = {
  amount: string;
  baseToken: string;
  quoteToken: string;
  taker: string;
  chain: string;
};
