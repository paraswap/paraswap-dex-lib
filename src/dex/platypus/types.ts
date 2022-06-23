import { Address } from '../../types';
import { ChainLinkState } from '../../lib/chainlink';
import { StakedAvaxState } from '../../lib/benqi/staked-avax';

export enum PlatypusOracleType {
  None = 'None',
  ChainLink = 'ChainLink',
  StakedAvax = 'StakedAvax',
}

export type PlatypusPoolStateCommon = {
  params: PlatypusPoolParams;
  asset: { [underlyingAddress: string]: PlatypusAssetState };
};

export type PlatypusPoolState = PlatypusPoolStateCommon & {
  chainlink: { [underlyingAddress: string]: ChainLinkState };
};

export type PlatypusPurePoolState = PlatypusPoolStateCommon;

export type PlatypusAvaxPoolState = PlatypusPoolStateCommon & {
  stakedAvax: StakedAvaxState;
};

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
    [poolAddress: string]:
      | PlatypusPoolConfigInfo
      | PlatypusPurePoolConfigInfo
      | PlatypusAvaxPoolConfigInfo;
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

export type PlatypusAvaxPoolConfigInfo = {
  oracleType: PlatypusOracleType.StakedAvax;
  priceOracleAddress: Address;
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
