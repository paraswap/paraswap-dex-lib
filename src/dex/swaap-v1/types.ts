import { Address } from '../../types';
import { ChainLinkState } from '../../lib/chainlink';
import { BigNumber } from '@0x/utils';

export type SwaapV1PoolState = {
  parameters: SwaapV1PoolParameters;
  liquidities: SwaapV1PoolLiquidities;
  oracles: SwaapV1PoolOracles;
};

export type SwaapV1PoolLiquidities = {
  [tokenAddress: Address]: TokenData;
};

export type SwaapV1PoolOracles = {
  [tokenAddress: Address]: OracleData;
};

export type SwaapV1PoolParameters = {
  swapFee: bigint;
  priceStatisticsLookbackInRound: number;
  priceStatisticsLookbackStepInRound: number;
  dynamicCoverageFeesZ: bigint;
  dynamicCoverageFeesHorizon: bigint;
  priceStatisticsLookbackInSec: bigint;
  maxPriceUnpegRatio: bigint;
};

export type TokenData = {
  balance: bigint;
  initialWeight: bigint;
  decimals: number;
};

export type OracleData = {
  oraclesBindState: OracleInitialData;
  latestRoundId: number;
  historicalOracleState: ChainLinkData;
};

// Oracle state when a token is binded/rebinded
export type OracleInitialData = {
  proxy: Address;
  aggregator: Address;
  price: bigint;
  decimals: number;
  description: string;
};

export type ChainLinkData = { [latestRoundId: number]: ChainLinkState };

export type DexParams = {
  subgraphURL: string;
  exchangeProxy: string;
};

export type SubgraphToken = {
  address: string;
  decimals: number;
  oracleInitialState: OracleInitialData;
  latestRoundId: number;
  oracleHistoricalStates: ChainLinkData;
};

export type TokenState = {
  balance: bigint;
  weight?: bigint;
};

export enum SwapTypes {
  SwapExactIn,
  SwapExactOut,
}

export interface callData {
  target: string;
  callData: string;
}

export type SwaapV1AssetState = {
  cash: bigint;
  liability: bigint;
};

export type SwaapV1Data = {
  pool: Address;
};

export interface SubgraphPoolBase {
  id: string;
  tokens: SubgraphToken[];
  liquidityUSD: number;
  swapFee: number;
  priceStatisticsLookbackInRound: number;
  priceStatisticsLookbackStepInRound: number;
  dynamicCoverageFeesZ: number;
  dynamicCoverageFeesHorizon: number;
  priceStatisticsLookbackInSec: number;
  maxPriceUnpegRatio: number;
}
export type SwaapV1Swap = {
  pool: Address;
  tokenIn: Address;
  tokenOut: Address;
  swapAmount: bigint;
  limitAmount: bigint;
  maxPrice: bigint;
};

export type SwaapV1ProxySwapArguments = [
  swaps: SwaapV1Swap[],
  tokenIn: Address,
  tokenOut: Address,
  lmimitAmount: bigint,
  deadline: bigint,
];

export type SwaapV1PoolSwapArguments = [
  tokenIn: Address,
  amountIn: bigint,
  tokenOut: Address,
  amountOut: bigint,
  maxPrice: bigint,
];
