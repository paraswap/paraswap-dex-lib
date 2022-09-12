import { Interface } from '@ethersproject/abi';
import { Address, Token } from '../../types';

export type PoolState = {
  priceFeed: ChainLinkPriceFeedState;
  pool: SynthereumPoolState;
};

export type ChainLinkPriceFeedState = {
  usdcPrice: bigint;
};

export type SynthereumPoolState = {
  feesPercentage: bigint;
};

export type JarvisV6Data = {
  poolAddress: string;
  swapFunction: JarvisSwapFunctions;
};

export type PoolConfig = {
  address: Address;
  priceFeedPair: string;
  syntheticToken: Token;
  collateralToken: Token;
  chainLinkAggregatorAddress: Address;
};

export type DexParams = {
  priceFeedAddress: Address;
  pools: PoolConfig[];
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

export enum JarvisSwapFunctions {
  MINT = 'mint',
  REDEEM = 'redeem',
}

export type JarvisV6SytemMaxVars = {
  maxTokensCapacity: bigint;
  totalSyntheticTokens: bigint;
};
