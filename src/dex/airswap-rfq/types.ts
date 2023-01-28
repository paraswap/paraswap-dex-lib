import BigNumber from 'bignumber.js';
import { RequestConfig } from '../../dex-helper/irequest-wrapper';
import { Address, Token } from '../../types';
import { AugustusOrderWithString } from '../paraswap-limit-orders/types';

export type Pair = {
  base: string;
  quote: string;
  liquidityUSD: number;
};

export type PairMap = {
  [pairName: string]: Pair;
};

export type PairsResponse = {
  pairs: PairMap;
};

export type PricingResponse = PairPriceResponse & {
  baseToken: string;
  quoteToken: string;
  minimum: string;
};

export type TokensResponse = {
  wallet: string;
  chainId: number;
  pricing: PricingResponse[];
};

export type PriceAndAmount = [string, string];

export type PriceAndAmountBigNumber = [BigNumber, BigNumber];

export type PairPriceResponse = {
  bid?: PriceAndAmount[];
  ask?: PriceAndAmount[];
};

export type RatesResponse = {
  prices: { [pair: string]: PairPriceResponse };
};

export type FetcherParams = {
  reqParams: RequestConfig;
  // secret: RFQSecret;
  intervalMs: number;
  dataTTLS: number;
};

export type Rates = Array<[string, string]>;
export type BigNumberRate = [BigNumber, BigNumber];
export type BigNumberRates = Array<BigNumberRate>;

type RequestConfigWithAuth = RequestConfig;

export type RFQConfig = {
  tokensConfig: FetcherParams;
  // pairsConfig: FetcherParams;
  // rateConfig: FetcherParams;
  // firmRateConfig: RequestConfigWithAuth;
  // blacklistConfig?: FetcherParams;
  maker: Address;
  pathToRemove?: string;
};

export type TokenWithAmount = Token & {
  amount: string;
};

export type RFQPayload = {
  makerAsset: Address;
  takerAsset: Address;
  makerAmount?: string;
  takerAmount?: string;
  userAddress: Address;
};

export type AugustusOrderWithStringAndSignature = AugustusOrderWithString & {
  signature: string;
};

export type RFQFirmRateResponse = {
  status: 'accepted' | 'rejected';
  order: AugustusOrderWithStringAndSignature;
};

export class SlippageCheckError extends Error {}
