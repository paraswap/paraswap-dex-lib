import { Address } from '../../types';
import { ChainLinkState } from '../../lib/chainlink';

export type PlatypusPoolState = {
  params: PlatypusPoolParams;
  chainlink: { [underlyingAddress: string]: ChainLinkState };
  asset: { [underlyingAddress: string]: PlatypusAssetState };
};

export type PlatypusPoolParams = {
  slippageParamK: bigint;
  slippageParamN: bigint;
  c1: bigint;
  xThreshold: bigint;
  haircutRate: bigint;
  retentionRatio: bigint;
  maxPriceDeviation: bigint;
};

export type PlatypusAssetState = {
  cash: bigint;
  liability: bigint;
};

export type PlatypusConfigInfo = {
  poolAddresses: Address[];
  pools: { [poolAddress: string]: PlatypusPoolConfigInfo };
};

export type PlatypusPoolConfigInfo = {
  priceOracleAddress: Address;
  tokenAddresses: Address[];
  tokens: {
    [tokenAddress: string]: {
      tokenSymbol: string;
      tokenDecimals: number;
      assetAddress: Address;
      chainlink: {
        proxyAddress: Address;
        aggregatorAddress: Address;
      };
    };
  };
};

export type PlatypusData = {
  pool: Address;
};

export type DexParams = {
  pools: {
    address: Address;
    name: string;
  }[];
};
