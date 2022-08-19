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
  chainLink: {
    interface: Interface;
    address: Address;
  };
};

export type priceFeedData = {
  interface: Interface;
  address: Address;
};

export type DexParams = {
  priceFeed: priceFeedData;
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
