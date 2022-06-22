import { Address } from '../../types';
import { ChainLinkState } from '../../lib/chainlink';

export enum PlatypusOracleType {
  None = 'None',
  ChainLink = 'ChainLink',
}

export type PlatypusPoolStateCommon = {
  params: PlatypusPoolParams;
  asset: { [underlyingAddress: string]: PlatypusAssetState };
};

export type PlatypusPoolState = PlatypusPoolStateCommon & {
  chainlink: { [underlyingAddress: string]: ChainLinkState };
};

export type PlatypusPurePoolState = PlatypusPoolStateCommon;

export type PlatypusPoolParams = {
  paused: boolean;
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
  pools: {
    [poolAddress: string]: PlatypusPoolConfigInfo | PlatypusPurePoolConfigInfo;
  };
};

export type PlatypusPoolConfigInfo = {
  oracleType: PlatypusOracleType.ChainLink;
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

export type PlatypusPurePoolConfigInfo = {
  oracleType: PlatypusOracleType.None;
  tokenAddresses: Address[];
  tokens: {
    [tokenAddress: string]: {
      tokenSymbol: string;
      tokenDecimals: number;
      assetAddress: Address;
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
    oracleType: PlatypusOracleType;
  }[];
};
