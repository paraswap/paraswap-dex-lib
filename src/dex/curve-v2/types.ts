import { Address, NumberAsString } from '@paraswap/core';

export type CurveV2DirectSwapParam = [
  NumberAsString, // packed curvedata
  number, // i
  number, // j
  Address, // pool address
  Address, // src token
  Address, // dest token,
  NumberAsString, // fromAmount
  NumberAsString, // toAmount
  NumberAsString, // quotedAmount,
  string, // metadata - bytes32
  Address, // beneficiary
];

export enum CurveV2SwapType {
  EXCHANGE,
  EXCHANGE_UNDERLYING,
  EXCHANGE_GENERIC_FACTORY_ZAP,
}
