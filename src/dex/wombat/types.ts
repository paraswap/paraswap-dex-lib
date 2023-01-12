import { Address } from '../../types';
import { ChainLinkState } from '../../lib/chainlink';

// State-related types

export type PoolState = {
  // poolState is the state of event
  // subscriber. This should be the minimum
  // set of parameters required to compute
  // pool prices.
  params: PoolParams;
  chainlink: { [underlyingAddress: string]: ChainLinkState };
  underlyingAddresses: Address[];
  asset: { [underlyingAddress: string]: AssetState };
};

export type AssetState = {
  cash: bigint;
  liability: bigint;
};

export type PoolParams = {
  ampFactor: bigint;
  haircutRate: bigint;
};

// Wombat Config types

export type WombatConfigInfo = {
  poolAddresses: Address[];
  pools: { [poolAddress: string]: WombatPoolConfigInfo };
};

export type WombatPoolConfigInfo = {
  tokenAddresses: Address[];
  tokens: {
    [tokenAddress: string]: {
      tokenSymbol: string;
      tokenDecimals: number;
      assetAddress: Address;
    };
  };
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
