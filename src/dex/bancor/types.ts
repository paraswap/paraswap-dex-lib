import { Address } from '@paraswap/core';

export type BancorData = {
  minDestToken: string;
  path: Address[];
  bancorNetwork?: string;
};

export type BancorParam = [
  path: Address[],
  srcAmount: string,
  minDestToken: string,
  affiliateAccount: string,
  affiliateFee: string,
];

export enum BancorFunctions {
  convert2 = 'convert2',
}
