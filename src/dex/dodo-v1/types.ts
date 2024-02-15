import { Address, NumberAsString } from '@paraswap/core';

export type DodoV1Data = {
  fromToken: Address;
  toToken: Address;
  dodoPairs: Address[];
  directions: string;
  isIncentive: boolean;
  deadLine: string;
};

export type DodoV1Param = [
  fromToken: Address,
  toToken: Address,
  fromTokenAmount: NumberAsString,
  minReturnAmount: NumberAsString,
  dodoPairs: Address[],
  directions: NumberAsString,
  isIncentive: boolean,
  deadLine: NumberAsString,
];

export enum DodoV1Functions {
  dodoSwapV1 = 'dodoSwapV1',
}
