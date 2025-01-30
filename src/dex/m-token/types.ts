import { Address } from '../../types';

// Data that returned by the API that can be used for
// tx building.
export type MTokenData = {};

export type DexParams = {
  fromToken: { address: Address; decimals: number };
  toToken: { address: Address; decimals: number };
};
