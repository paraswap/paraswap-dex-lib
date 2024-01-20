import { Address, NumberAsString } from '@paraswap/core';

export type CurveV2DirectSwapParam = [
  curveData: NumberAsString, // packed curvedata
  i: number, // i
  j: number, // j
  poolAddress: Address, // pool address
  srcToken: Address, // src token
  destToken: Address, // dest token,
  fromAmount: NumberAsString, // fromAmount
  toAmount: NumberAsString, // toAmount
  quotedAmount: NumberAsString, // quotedAmount,
  metadata: string, // metadata - bytes32
  beneficiary: Address, // beneficiary
];

export enum CurveV2SwapType {
  EXCHANGE,
  EXCHANGE_UNDERLYING,
  EXCHANGE_GENERIC_FACTORY_ZAP,
}

export type CurveV2DirectSwap = [
  params: CurveV2DirectSwapParam,
  partnerAndFee: string,
  permit: string,
];
