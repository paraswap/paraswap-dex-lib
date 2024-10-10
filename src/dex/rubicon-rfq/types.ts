import { ERROR_CODE_TO_RESTRICT_TTL, UNKNOWN_ERROR_CODE } from './constants';
import { RequestHeaders } from '../../dex-helper';
import { Address } from '../../types';
import { Network } from '../../constants';
import BigNumber from 'bignumber.js';

export type ErrorCode = keyof typeof ERROR_CODE_TO_RESTRICT_TTL;

export class SlippageCheckError extends Error {
  code: ErrorCode = 'SLIPPAGE';
}

export class RfqError extends Error {
  code: ErrorCode;
  constructor(message: string, code: ErrorCode = UNKNOWN_ERROR_CODE) {
    super(message);
    this.code = code;
  }
}

// Arguments to RFQ's 'fill()' function.
export type RubiconRfqData = {
  q: {
    sellToken: string;
    buyToken: string;
    sellAmt: bigint;
    buyAmt: bigint;
  };
  r: {
    orders: SignedOrder[];
    quantities: bigint[];
    deadline: number;
  };
  signature: string;
};

export type SignedOrder = {
  order: string;
  sig: string;
};

export type DexParams = {
  rfqAddress: Address;
};

export interface PriceLevel {
  price: BigNumber;
  quantity: BigNumber;
}

export interface Market {
  // [[price_0, quantity_0], ..., [price_n, quantity_n]]
  asks: string[][];
  bids: string[][];
}

export interface RubiconRfqMarketsResponse {
  status: string;
  chainId: string;
  // marketId => asks/bids
  markets: Record<string, Market>;
}

export interface RubiconRfqLiquidityResponse {
  status: string;
  chainId: string;
  liquidityUsd: Record<string, string>;
}

export interface MatchResponse {
  orders: SignedOrder[];
  quantities: string[];
  deadline: string;
}

export interface Pair {
  sellToken: string;
  buyToken: string;
}

export interface Amounts {
  sellAmt: string;
  buyAmt: string;
}

export interface RubiconRfqMatchResponse {
  status: string;
  chainId: string;
  response: MatchResponse;
  pair: Pair;
  amounts: Amounts;
  fillType: string;
  rfqsig: string;
}

export type Quote = {
  tag: string;
  chainId: Network;

  // Optional for '/markets' request.
  sellToken?: Address;
  buyToken?: Address;
  deadline?: number;

  // Used only to get a match.
  sellAmt?: string;
  buyAmt?: string;
};

export type RubiconRfqRateFetcherConfig = {
  rateConfig: {
    marketsReqParams: {
      url: string;
      headers: RequestHeaders;
      params: Quote;
    };
    liquidityReqParams: {
      url: string;
      headers: RequestHeaders;
      params: Quote;
    };
    marketsIntervalMs: number;
    liquidityIntervalMs: number;
    marketsCacheKey: string;
    marketsCacheTTLSecs: number;
    liquidityCacheKey: string;
    liquidityCacheTTLSecs: number;
  };
};
