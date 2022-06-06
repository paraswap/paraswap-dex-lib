import { Address } from '../../types';
import { ChainLinkState } from '../../lib/chainlink';

export type PoolState = {
  primaryPrices: { [poolAddress: string]: ChainLinkState };
  secondaryPrices: FastPriceFeedState;
  vault: VaultState;
  usdm: USDMState;
};

export type FastPriceFeedState = {
  lastUpdatedAt: number;
  prices: { [tokenAddress: string]: bigint };
};

export type VaultState = {
  usdmAmounts: { [tokenAddress: string]: bigint };
};

export type USDMState = {
  totalSupply: bigint;
};

export type MetavaultTradeData = {
  // TODO: MetavaultTradeData is the dex data that is
  // returned by the API that can be used for
  // tx building. The data structure should be minimal.
  // Complete me!
};

export type DexParams = {
  vault: Address;
  priceFeed: Address;
  fastPriceFeed: Address;
  fastPriceEvents: Address;
  // Last three param can be fetched on chain by calling
  // vaultAddress.priceFeed() => priceFeed
  // priceFeed.secondaryPriceFeed() => fastPriceFeed
  // fastPriceFeed.fastPriceEvents() => fastPriceEvents
  // It is added as constants to avoid unnecessary
  // sequential onchain calls
  usdm: Address;
};

export type FastPriceFeedConfig = {
  priceDuration: number;
  maxDeviationBasisPoints: bigint;
  favorFastPrice: boolean;
  volBasisPoints: bigint;
};

export type VaultPriceFeedConfig = {
  isAmmEnabled: boolean;
  isSecondaryPriceEnabled: boolean;
  strictStableTokens: { [address: string]: boolean };
  spreadBasisPoints: { [address: string]: bigint };
  adjustmentBasisPoints: { [address: string]: bigint };
  isAdjustmentAdditive: { [address: string]: boolean };
  priceDecimals: { [address: string]: number };
  maxStrictPriceDeviation: bigint;
  useV2Pricing: boolean;
  priceSampleSpace: number;
};

export type VaultConfig = {
  tokenDecimals: { [address: string]: number };
  stableTokens: { [address: string]: boolean };
  tokenWeights: { [address: string]: bigint };
  stableSwapFeeBasisPoints: bigint;
  swapFeeBasisPoints: bigint;
  stableTaxBasisPoints: bigint;
  taxBasisPoints: bigint;
  hasDynamicFees: bigint;
  includeAmmPrice: boolean;
  useSwapPricing: boolean;
  totalTokenWeights: bigint;
};

export type PoolConfig = {
  vaultAddress: Address;
  priceFeed: Address;
  fastPriceFeed: Address;
  fastPriceEvents: Address;
  usdmAddress: Address;
  tokenAddresses: Address[];
  vaultConfig: VaultConfig;
  vaultPriceFeedConfig: VaultPriceFeedConfig;
  fastPriceFeedConfig: FastPriceFeedConfig;
  chainlink: { [address: string]: { proxy: Address; aggregator: Address } };
};
