import { NumberAsString } from '@paraswap/core';

export type StablePoolData = {
  exchange: string;
  i: string;
  j: string;
  deadline: string;
};

export type StablePoolParam = [
  i: NumberAsString,
  j: NumberAsString,
  dx: NumberAsString,
  min_dy: NumberAsString,
  deadline?: string,
];

export enum StablePoolFunctions {
  swap = 'swap',
}
