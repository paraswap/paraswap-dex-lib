import { Address } from '../../types';

// OSwapPoolState is the state of the event subscriber. It is the minimum
// set of parameters required to compute pool prices.
export type OSwapPoolState = {
  traderate0: bigint;
  traderate1: bigint;
  balance0: bigint;
  balance1: bigint;
};

// OSwapPoolState is the state of the event subscriber. It is the minimum
// set of parameters required to compute pool prices.
export type OSwapData = {
  pool: Address;
  receiver: Address;
  path: Address[];
};

// Each pool has a contract address and token pairs.
export type OSwapPool = {
  id: string;
  address: Address,
  token0: Address,
  token1: Address
};

export type DexParams = {
  pools: [OSwapPool];
};
