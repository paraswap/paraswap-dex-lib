import { Address } from '../../types';
import { Api3FeedSubscriberState } from '../../lib/api3-feed';

export type PoolState = {
  primaryPrices: { [poolAddress: string]: Api3FeedSubscriberState };
  secondaryPrices: FastPriceFeedState;
  vault: VaultState;
  usdq: USDQState;
};

export type FastPriceFeedState = {
  lastUpdatedAt: number;
  prices: { [tokenAddress: string]: bigint };
};

export type VaultState = {
  usdqAmounts: { [tokenAddress: string]: bigint };
};

export type USDQState = {
  totalSupply: bigint;
};

export type QuickPerpsData = {
  // TODO: QuickPerpsData is the dex data that is
  // returned by the API that can be used for
  // tx building. The data structure should be minimal.
  // Complete me!
};

export type DexParams = {
  vault: Address;
  reader: Address;
  priceFeed: Address;
  fastPriceFeed: Address;
  fastPriceEvents: Address;
  // Last three param can be fetched on chain by calling
  // vaultAddress.priceFeed() => priceFeed
  // priceFeed.secondaryPriceFeed() => fastPriceFeed
  // fastPriceFeed.fastPriceEvents() => fastPriceEvents
  // It is added as constants to avoid unnecessary
  // sequential onchain calls
  usdq: Address;
};

export type FastPriceFeedConfig = {
  priceDuration: number;
  maxDeviationBasisPoints: bigint;
  favorFastPrice: Record<string, boolean>;
  spreadBasisPointsIfInactive: bigint;
  spreadBasisPointsIfChainError: bigint;
  maxPriceUpdateDelay: number;
};

export type VaultPriceFeedConfig = {
  isSecondaryPriceEnabled: boolean;
  strictStableTokens: { [address: string]: boolean };
  spreadBasisPoints: { [address: string]: bigint };
  adjustmentBasisPoints: { [address: string]: bigint };
  isAdjustmentAdditive: { [address: string]: boolean };
  priceDecimals: { [address: string]: number };
  maxStrictPriceDeviation: bigint;
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
  readerAddress: Address;
  priceFeed: Address;
  fastPriceFeed: Address;
  fastPriceEvents: Address;
  usdqAddress: Address;
  tokenAddresses: Address[];
  vaultConfig: VaultConfig;
  vaultPriceFeedConfig: VaultPriceFeedConfig;
  fastPriceFeedConfig: FastPriceFeedConfig;
  api3ServerV1: {
    [address: string]: { proxy: Address; api3ServerV1: Address };
  };
};
