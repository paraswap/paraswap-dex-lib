import { Address, EncodeContractMethod } from '../types';
import { SwapSide } from '../constants';

type AdapterExchangeParam = {
  index: number;
  targetExchange: Address;
  payload: string;
  networkFee: string;
}

type SimpleExchangeParam = {
  callees: string[];
  calldata: string[];
  values: string[];
};

export interface IDex<ExchangeData, DirectParam = null> {
  
  // Used for multiSwap, buy & megaSwap
  getAdapterParam(
    fromToken: Address,
    toToken: Address,
    fromAmount: BigInt,
    toAmount: BigInt, // required for buy case
    data: ExchangeData,
    side: SwapSide
  ): AdapterExchangeParam;
  // Used for simpleSwap & simpleBuy 
  getSimpleParam(
    fromToken: Address,
    toToken: Address,
    fromAmount: BigInt,
    toAmount: BigInt,
    data: ExchangeData,
    side: SwapSide
  ): SimpleExchangeParam;
  // Used if there is a possibility for direct swap (Eg. UniswapV2, 0xV2/V4, etc)
  getDirectParam?(
    fromToken: Address,
    toToken: Address,
    fromAmount: BigInt,
    toAmount: BigInt,
    data: ExchangeData,
    side: SwapSide
  ): [EncodeContractMethod, DirectParam];
}

export type DexMap = {[identifier: string]: IDex<any, any>};