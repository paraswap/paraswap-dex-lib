import { Address } from '../../types';

export type TokenInfo = {
  address: Address;
  tokenBalance: bigint;
};

export type PoolState = {
  poolAddress: Address;
  tokensToId: Record<Address, number>;
  tokenInfo: TokenInfo[];
  borrowFee: bigint;
  PCT_PRECISION: bigint;
  TOKENS_MUL: bigint[];
};

export type HodltreeFlashloanExchangeData = {
  poolAddress: Address;
};

export type DexParams = {
  // TODO: DexParams is set of parameters the can
  // be used to initiate a DEX fork.
  // Complete me!
  pools: Address[];
  exchange: Address;
};

export type PoolStateMap = Record<string, PoolState>;
