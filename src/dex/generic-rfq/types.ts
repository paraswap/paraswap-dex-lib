import BigNumber from 'bignumber.js';
import { SwapSide } from 'paraswap-core';
import { RequestConfig } from '../../dex-helper/irequest-wrapper';
import { Address, Token } from '../../types';
import { OrderInfo } from '../paraswap-limit-orders/types';

type Pair = {
  id: string;
  base: Token;
  quote: Token;
  status: string;
};

export type PairMap = {
  [pairName: string]: Pair;
};

export type MarketResponse = {
  markets: Pair[];
};

export type PairPriceResponse = {
  buyAmounts: string[];
  buyPrices: string[];
  sellAmounts: string[];
  sellPrices: string[];
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

export type OrderPriceInfo = {
  reversed: boolean;
  from: Token;
  to: Token;
  side: SwapSide;
  rates: BigNumberRates;
};

export type RFQModel = 'firm' | 'indicative';

export type RFQConfig = {
  marketConfig: FetcherParams;
  rateConfig: FetcherParams;
  firmRateConfig: RequestConfig;
};

export type RFQPayload = {
  makerAsset: Address;
  takerAsset: Address;
  model: RFQModel;
  side: SwapSide;
  makerAmount?: string;
  takerAmount?: string;
  taker: Address;
  txOrigin: Address;
};

export type RFQFirmRateResponse = {
  status: 'accepted' | 'rejected';
  order: OrderInfo;
};
