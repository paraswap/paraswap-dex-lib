import { SwapSide, ContractMethod } from './constants';

export type Address = string;
export type NumberAsString = string;

export type Adapters = {address: Address, exchanges: {exchangeKey: string, index: number}[]}[];

export type OptimalRoute = {
  percent: number;
  swaps: OptimalSwap[];
};

export type OptimalSwap = {
  src: Address;
  srcDecimals: number;
  dest: Address;
  destDecimals: number;
  swapExchanges: OptimalSwapExchange[];
};

export type OptimalSwapExchange = {
  exchange: string;
  srcAmount: NumberAsString;
  destAmount: NumberAsString;
  percent: number;
  data?: any;
};

export type OptionalRate = {
  exchange: string;
  srcAmount: NumberAsString;
  destAmount: NumberAsString;
  unit?: NumberAsString;
  data?: any;
};

export type OptimalRate = {
  blockNumber: number;
  network: number;
  src: Address;
  srcDecimals: number;
  srcAmount: NumberAsString;
  srcUSD: NumberAsString;
  dest: Address;
  destDecimals: number;
  destAmount: NumberAsString;
  destUSD: NumberAsString;
  bestRoute: OptimalRoute[];
  gasCostUSD: NumberAsString;
  gasCost: NumberAsString;
  others?: OptionalRate[];
  side: SwapSide;
  contractMethod: ContractMethod;
  tokenTransferProxy: Address;
  contractAddress: Address;
  maxImpact?: number;
  maxUSDImpact?: number;
  maxImpactReached?: boolean;
  partner?: string;
  hmac: string;
};

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
};

export type ContractBuyData = {
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  beneficiary: string;
  adapters: ContractBuyAdapter[];
  partner: string;
  feePercent: string;
  permit: string;
  deadline: string;
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
};

// TODO: fix the type
export type ContractMethodEncoder = (...args: any[]) => any;
