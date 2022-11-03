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

export type TokenWithInfo = Token & {
  name: string;
  description: string;
};

export type TokensResponse = {
  tokens: Record<string, TokenWithInfo>;
};

export type PriceAndAmount = [string, string];

export type PriceAndAmountBigNumber = [BigNumber, BigNumber];

export type PairPriceResponse = {
  bids: PriceAndAmount[];
  asks: PriceAndAmount[];
};

export type RatesResponse = {
  [pair: string]: PairPriceResponse;
};

export type RFQSecret = {
  domain: string;
  accessKey: string;
  secretKey: string;
};

export type FetcherParams = {
  reqParams: RequestConfig;
  secret: RFQSecret;
  intervalMs: number;
  dataTTLS: number;
};

export type Rates = Array<[string, string]>;
export type BigNumberRate = [BigNumber, BigNumber];
export type BigNumberRates = Array<BigNumberRate>;

export type RFQModel = 'firm' | 'indicative';

type RequestConfigWithAuth = RequestConfig & {
  secret?: RFQSecret;
};

export type RFQConfig = {
  tokensConfig: FetcherParams;
  pairsConfig: FetcherParams;
  rateConfig: FetcherParams;
  firmRateConfig: RequestConfigWithAuth;
  maker: Address;
};

export type TokenWithAmount = Token & {
  amount: string;
};

export type RFQPayload = {
  makerAsset: Address;
  takerAsset: Address;
  model: RFQModel;
  makerAmount?: string;
  takerAmount?: string;
  taker: Address;
  txOrigin: Address;
};

export type AugustusOrderWithStringAndSignature = AugustusOrderWithString & {
  signature: string;
};

export type RFQFirmRateResponse = {
  status: 'accepted' | 'rejected';
  order: AugustusOrderWithStringAndSignature;
};
