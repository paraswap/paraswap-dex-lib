import { Address } from '../../types';
import {NumberAsString} from "@paraswap/core";

export type PoolState = {
  // TODO: poolState is the state of event
  // subscriber. This should be the minimum
  // set of parameters required to compute
  // pool prices. Complete me!
};

export type SwaplineV21Data = {
  tokenIn: string; // redundant
  tokenOut: string; // redundant
  binStep: string;
  // exchange: Address;
};

export type DexParams = {
  // TODO: DexParams is set of parameters the can
  // be used to initiate a DEX fork.
  // Complete me!
  // factoryAddress: Address;
};

export enum SwapLineV21RouterFunctions {
  swapExactTokensForTokens = 'swapExactTokensForTokens',
  swapTokensForExactTokens = 'swapTokensForExactTokens',
}

type RouterPath = [
  pairBinSteps: NumberAsString[],
  versions: NumberAsString[],
  tokenPath: Address[],
];

type SwapLineV21RouterSellParams = [
  _amountIn: NumberAsString,
  _amountOutMin: NumberAsString,
  _routerPath: RouterPath,
  to: Address,
  _deadline: string,
];

type SwapLineV21RouterBuyParams = [
  _amountOut: NumberAsString,
  _amountInMax: NumberAsString,
  _routerPath: RouterPath,
  to: Address,
  _deadline: string,
];

export type SwapLineV21RouterParam =
  | SwapLineV21RouterSellParams
  | SwapLineV21RouterBuyParams;

export type SwapLineV21Data = {
  tokenIn: string; // redundant
  tokenOut: string; // redundant
  binStep: string;
};
