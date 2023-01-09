import { Address } from '../../types';

export type PoolState = {
  // TODO: poolState is the state of event
  // subscriber. This should be the minimum
  // set of parameters required to compute
  // pool prices. Complete me!
};

export type WombatData = {
  // TODO: WombatData is the dex data that is
  // returned by the API that can be used for
  // tx building. The data structure should be minimal.
  // Complete me!
  exchange: Address;
};

export type DexParams = {
  // DexParams is set of parameters that can be used to initiate a DEX fork.
  pools: {
    address: Address;
    name: string;
  }[];
};
