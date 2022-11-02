import BigNumber from 'bignumber.js';
import { RequestConfig } from '../../dex-helper/irequest-wrapper';
import { Address, Token } from '../../types';
import { AugustusOrderWithString } from '../paraswap-limit-orders/types';

type Pair = {
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

export type FetcherParams = {
  reqParams: RequestConfig;
  intervalMs: number;
  dataTTLS: number;
};

export type Rates = Array<[string, string]>;
export type BigNumberRate = [BigNumber, BigNumber];
export type BigNumberRates = Array<BigNumberRate>;

export type RFQModel = 'firm' | 'indicative';

export type RFQConfig = {
  tokensConfig: FetcherParams;
  pairsConfig: FetcherParams;
  rateConfig: FetcherParams;
  firmRateConfig: RequestConfig;
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

export type RFQFirmRateResponse = {
  status: 'accepted' | 'rejected';
  order: AugustusOrderWithString & {
    signature: string;
  };
};
