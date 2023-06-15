import { Result } from '@ethersproject/abi';
import { Address } from '../../types';
import { BigNumber } from 'ethers';

export type PoolState = {
  // TODO: poolState is the state of event
  // subscriber. This should be the minimum
  // set of parameters required to compute
  // pool prices. Complete me!
  prices: FastPriceFeedState;
  vault: VaultState;
  investPool: IInvestPoolProps[];
  log?: LogState;
};

export type FastPriceFeedState = {
  lastUpdatedAt: number;
  prices: { [tokenAddress: string]: bigint };
};

export type VaultState = {
  alpAmounts: { [tokenAddress: string]: bigint };
};

export type LogState = {
  account: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  amountOut: bigint;
  amountOutAfterFee: bigint;
  swapFeeBps: bigint;
};

export interface callData {
  target: string;
  callData: string;
}

export type AlpacaData = {
  // TODO: AlpacaData is the dex data that is
  // returned by the API that can be used for
  // tx building. The data structure should be minimal.
  // Complete me!
};

export type DexParams = {
  poolRouter: string;
  Pyth: string;
  latestPriceFeedsURL: string;
  poolDiamond: string;
};

export type AlpacaPoolConfigs = {
  poolTokens: Record<string, PoolToken>;
};

export type StablePoolTokens = {
  stablePoolTokens: Record<string, string>;
};

export type Price = {
  conf: string;
  expo: number;
  price: string;
  publishTime: number;
};

export type PriceFeedMetadata = {
  attestationTime: number;
  emitterChain: number;
  priceServiceReceiveTime: number;
  sequenceNumber: number;
};

export type PriceFeed = {
  emaPrice: Price;
  id: string;
  metadata?: PriceFeedMetadata;
  vaa: string;
  price: Price;
};

export type PoolToken = {
  Symbol: string;
  Address: string;
  PriceId: string;
  Decimal: number;
};

export type IInvestPoolProps = {
  stableSwapFeeRate: BigNumber;
  stableTaxRate: BigNumber;
  swapFeeRate: BigNumber;
  taxRate: BigNumber;
  liquidity: BigNumber;
  isStrategyProfit: boolean;
  strategyDelta: BigNumber;
  reservedOf: BigNumber;
  guaranteedUsdOfE30: BigNumber;
  shortSizeOfE30: BigNumber;
  shortAveragePriceOfE30: BigNumber;
  tokenMetas: TokenConfigStructOutput;
  tokenAddress: string;
  maxPrice: BigNumber;
  minPrice: BigNumber;
  isStableToken: boolean;
  isDynamicFeeEnable: boolean;
  additionalAum: BigNumber;
  discountedAum: BigNumber;
  fundingFeePayableE30: BigNumber;
  fundingFeeReceivableE30: BigNumber;
  priceUpdateData: string;
};

export type TokenConfigStructOutput = {
  accept: boolean;
  isStable: boolean;
  isShortable: boolean;
  decimals: number;
  weight: BigNumber;
  minProfitBps: BigNumber;
  usdDebtCeiling: BigNumber;
  shortCeiling: BigNumber;
  bufferLiquidity: BigNumber;
  openInterestLongCeiling: BigNumber;
};
