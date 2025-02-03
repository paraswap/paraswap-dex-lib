import { Address } from '../../types';

// Data that returned by the API that can be used for
// tx building.
export type MTokenData = {};

export type DexParams = {
  MTOKEN: { address: Address; decimals: number };
  WRAPPEDM: { address: Address; decimals: number };
};
