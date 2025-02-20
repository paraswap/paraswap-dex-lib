import { Address } from '../../types';

// Data that returned by the API that can be used for
// tx building.
export type MTokenData = {};

export type DexParams = {
  MToken: { address: Address; decimals: number };
  WrappedM: { address: Address; decimals: number };
};
