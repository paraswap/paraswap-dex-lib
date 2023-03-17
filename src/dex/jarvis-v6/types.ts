import { Interface } from '@ethersproject/abi';
import { ChainLinkState } from '../../lib/chainlink';
import { Address, Token } from '../../types';

export type PoolState = {
  chainlink: {
    [pair: string]: ChainLinkState;
  };
  pool: SynthereumPoolState;
};

export type SynthereumPoolState = {
  feesPercentage: bigint;
};

export type DexParams = {
  chainLink: ChainLink;
  pools: PoolConfig[];
};

export type PoolConfig = {
  address: Address;
  pair: string;
  syntheticToken: Token;
  collateralToken: Token;
  priceFeed: PriceFeed[];
};

export type PriceFeed = {
  pair: string;
  isReversePrice: boolean;
  proxy: Address;
  aggregator: Address;
};

export type ChainLink = {
  [pair: string]: { proxy: Address; aggregator: Address };
};

type JarvisV6MintParam = [
  minNumTokens: string,
  collateralAmount: string,
  expiration: string,
  recipient: string,
];

type JarvisV6RedeemParam = [
  numTokens: string,
  minCollateral: string,
  expiration: string,
  recipient: string,
];

export type JarvisV6Params = JarvisV6MintParam | JarvisV6RedeemParam;

export type JarvisV6Data = {
  poolAddress: string;
  swapFunction: JarvisSwapFunctions;
};

export enum JarvisSwapFunctions {
  MINT = 'mint',
  REDEEM = 'redeem',
}

export type JarvisV6SystemMaxVars = {
  maxTokensCapacity: bigint;
  totalSyntheticTokens: bigint;
};
