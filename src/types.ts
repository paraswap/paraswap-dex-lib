import { SwapSide } from './constants';
import { Address } from 'paraswap-core';

export {
  Address,
  NumberAsString,
  Adapters,
  OptimalRoute,
  OptimalSwap,
  OptimalSwapExchange,
  OptionalRate,
  OptimalRate,
} from 'paraswap-core';

export type ContractSellData = {
  fromToken: string;
  fromAmount: string;
  toAmount: string;
  expectedAmount: string;
  beneficiary: string;
  path: ContractPath[];
  partner: string;
  feePercent: string;
  permit: string;
  deadline: string;
  uuid: string;
};

export type ContractMegaSwapSellData = {
  fromToken: string;
  fromAmount: string;
  toAmount: string;
  expectedAmount: string;
  beneficiary: string;
  path: ContractMegaSwapPath[];
  partner: string;
  feePercent: string;
  permit: string;
  deadline: string;
  uuid: string;
};

export type ContractBuyData = {
  adapter: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  beneficiary: string;
  route: ContractRoute[];
  partner: string;
  feePercent: string;
  permit: string;
  deadline: string;
  uuid: string;
};

export type ConstractSimpleData = {
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  expectedAmount: string;
  callees: string[];
  exchangeData: string;
  startIndexes: number[];
  values: string[];
  beneficiary: string;
  partner: string;
  feePercent: string;
  permit: string;
  deadline: string;
  uuid: string;
};

export type ContractAdapter = {
  adapter: string;
  percent: string;
  networkFee: string;
  route: ContractRoute[];
};

export type ContractRoute = {
  index: number;
  targetExchange: string;
  percent: string;
  payload: string;
  networkFee: string;
};

export type ContractMegaSwapPath = {
  fromAmountPercent: string;
  path: ContractPath[];
};

export type ContractPath = {
  to: string;
  totalNetworkFee: string;
  adapters: ContractAdapter[];
};

export type ContractBuyAdapter = {
  adapter: string;
  payload: string;
  networkFee: string;
  route: ContractBuyRoute[];
};

export type ContractBuyRoute = {
  index: number;
  targetExchange: string;
  fromAmount: string;
  toAmount: string;
  payload: string;
  networkFee: string;
};

export type TxInfo<T> = {
  params: T;
  encoder: ContractMethodEncoder;
  networkFee: string;
};

export type AdapterExchangeParam = {
  targetExchange: Address;
  payload: string;
  networkFee: string;
};

export type SimpleExchangeParam = {
  callees: string[];
  calldata: string[];
  values: string[];
  networkFee: string;
};

// TODO: fix the type
export type ContractMethodEncoder = (...args: any[]) => any;
