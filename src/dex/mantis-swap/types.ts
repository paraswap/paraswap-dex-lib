import { Address } from '../../types';
import { ChainLinkState } from '../../lib/chainlink';

export type MantisPoolStateCommon = {
  params: MantisPoolParams;
  asset: { [underlyingAddress: string]: MantisLPState };
};

export type MantisPoolState = MantisPoolStateCommon & {
  chainlink: { [underlyingAddress: string]: ChainLinkState };
};

export type MantisPoolParams = {
  paused: boolean;
  slippageA: bigint;
  slippageN: bigint;
  slippageK: bigint;
  baseFee: bigint;
  lpRatio: bigint;
  riskProfile: {
    [token: Address]: bigint;
  };
};

export type MantisLPState = {
  asset: bigint;
  liability: bigint;
  decimals: number;
};

export type MantisConfigInfo = {
  poolAddresses: Address[];
  pools: {
    [poolAddress: string]: MantisPoolConfigInfo;
  };
};

export type MantisPoolConfigInfo = {
  tokenAddresses: Address[];
  tokens: {
    [tokenAddress: string]: {
      tokenSymbol: string;
      tokenDecimals: number;
      lpAddress: Address;
      chainlink: {
        proxyAddress: Address;
        aggregatorAddress: Address;
      };
    };
  };
};

export type MantisSwapData = {
  pool: Address;
};

export type DexParams = {
  pools: {
    address: Address;
    name: string;
    tokenAddresses: Address[];
  }[];
};
