import { Address } from '../../types';
import { BigNumber } from 'ethers';
import { NumberAsString } from '@paraswap/core';

export type PoolState = {
  // TODO: poolState is the state of event
  // subscriber. This should be the minimum
  // set of parameters required to compute
  // pool prices. Complete me!
};

export type TraderJoeV2_1Data = {
  // TODO: TraderJoeV2_1_2Data is the dex data that is
  // returned by the API that can be used for
  // tx building. The data structure should be minimal.
  // Complete me!
  tokenIn: string;
  tokenOut: string;
  binStep: string;
};

export type DexParams = {
  factoryAddress: Address;
  routerAddress: Address;
};

export type LBPairsAvailable = {
  binStep: BigNumber;
  LBPair: string;
  createdByOwner: boolean;
  ignoredForRouting: boolean;
  tokenX: string;
};

export type RouterPath = [
  pairBinSteps: NumberAsString[],
  versions: NumberAsString[],
  tokenPath: Address[],
];
export type TraderJoeV2RouterSellParams = [
  _amountIn: NumberAsString,
  _amountOutMin: NumberAsString,
  _routerPath: RouterPath,
  to: Address,
  _deadline: string,
];

export type TraderJoeV2RouterBuyParams = [
  _amountOut: NumberAsString,
  _amountInMax: NumberAsString,
  _routerPath: RouterPath,
  to: Address,
  _deadline: string,
];

export type TraderJoeV2RouterParam =
  | TraderJoeV2RouterSellParams
  | TraderJoeV2RouterBuyParams;

export enum TraderJoeV2RouterFunctions {
  swapExactTokensForTokens = 'swapExactTokensForTokens',
  swapTokensForExactTokens = 'swapTokensForExactTokens',
}
