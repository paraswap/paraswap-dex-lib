import { Address, Token } from '../../types';
import { IntegralEventPool } from './integral-pool';
import { PoolState as UniswapPoolState } from '../uniswap-v3/types';
import { BigNumber } from 'ethers';
import { IntegralPricing } from './integral-pricing';

export type Requires<Class, Prop extends keyof Class> = Class &
  Required<Pick<Class, Prop>>;

export type IntegralPool = {
  base?: IntegralEventPool;
  pricing?: IntegralPricing;
  enabled: boolean;
};

export type QuotingProps = {
  poolAddress: Address;
  price: bigint;
  fee: bigint;
  tokenOutLimits: [bigint, bigint];
  decimalsConverter: bigint;
};

export type PoolState = {
  swapFee: bigint;
  mintFee: bigint;
  burnFee: bigint;
  decimals0: number;
  decimals1: number;
  oracle: Address;
  uniswapPool: Address;
  uniswapPoolFee: bigint;
};

export type RelayerPoolState = {
  isEnabled: boolean;
  swapFee: bigint;
  twapInterval: number;
  limits: {
    min0: bigint;
    min1: bigint;
    maxMultiplier0: bigint;
    maxMultiplier1: bigint;
  };
};
export type RelayerTokensState = {
  [tokenAddress: string]: { balance: bigint };
};
export type RelayerState = {
  pools: { [poolAddress: string]: RelayerPoolState };
  tokens: RelayerTokensState;
};

export type PoolInitProps = {
  [poolAddress: string]: { token0: Address; token1: Address };
};
export type FactoryState = { pools: PoolInitProps };

export type PoolStates = {
  base: PoolState;
  relayer: RelayerPoolState;
  relayerTokens: RelayerTokensState;
  pricing: UniswapPoolState;
  poolAddress: Address;
};

export type TokenState = Record<string, never>;

export type IntegralData = {
  relayer: Address;
};

export type DexParams = {
  factoryAddress: string;
  relayerAddress: string;
  subgraphURL?: string;
};

export enum IntegralFunctions {
  swap = 'sell',
  buy = 'buy',
}

export type Observation = {
  blockTimestamp: number;
  initialized: boolean;
  secondsPerLiquidityCumulativeX128: BigNumber;
  tickCumulative: BigNumber;
};
