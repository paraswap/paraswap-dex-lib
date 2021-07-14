import { SwapSide, ContractMethod } from './constants';

export type Address = string;
export type NumberAsString = string;

export type OptimalRoute = {
  percent: number;
  swaps: OptimalSwap[]; 
}

export type OptimalSwap = {
  src: Address;
  srcDecimals: number;
  dest: Address;
  destDecimals: number;
  swapExchanges: OptimalSwapExchange[] 
}

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
  srcUSD?: NumberAsString;
  dest: Address; 
  destDecimals: number; 
  destAmount: NumberAsString;
  destUSD?: NumberAsString;
  bestRoute: OptimalRoute[];
  gasCostUSD?: NumberAsString;
  gasCost: NumberAsString;
  others?: OptionalRate[];
  side: SwapSide;
  contractMethod: ContractMethod;
  tokenTransferProxy: Address;
  contractAddress: Address;
  maxImpact?: number;
  maxUSDImpact?: number;
  maxImpactReached: boolean;
  partner?: string;
  hmac: string; 
}; 

// TODO: fix the type
export type EncodeContractMethod = (...args: any[]) => any
