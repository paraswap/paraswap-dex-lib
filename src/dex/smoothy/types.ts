import { NumberAsString } from '@paraswap/core';

export type SmoothyData = {
  exchange: string;
  i: string;
  j: string;
};

export type SmoothyParam = [
  bTokenIdxIn: NumberAsString,
  bTokenIdxOut: NumberAsString,
  bTokenInAmount: NumberAsString,
  bTokenOutMin: NumberAsString,
];

export enum SmoothyFunctions {
  swap = 'swap',
}
