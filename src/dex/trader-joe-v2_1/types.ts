import { BigNumber } from 'ethers';
import { NumberAsString } from '@paraswap/core';
import { Address } from '../../types';

export type TraderJoeV2Data = {
  tokenIn: string;
  tokenOut: string;
  binStep: string;
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

export type DexParams = {
  factoryAddress: Address;
  routerAddress: Address;
};
