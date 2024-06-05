import { Address } from '@paraswap/core';

export type OnebitData = {
  router: Address;
};

export type OnebitParam = [
  srcToken: string,
  destToken: string,
  srcAmount: string,
  destAmountMin: string,
  to: string,
];

export enum OnebitFunctions {
  swapTokensWithTrust = 'swapTokensWithTrust',
}
