export type TokenGlobal = {
  info: TokenRecord;
  latestRound: LatestRound;
};

export type LatestRound = {
  roundId: number;
  price: bigint;
  timestamp: bigint;
};

export type HistoricalPricesParameters = {
  lookbackInRound: number;
  lookbackInSec: bigint;
  timestamp: bigint;
  lookbackStepInRound: number;
};

export type HistoricalPricesData = {
  startIndex: number;
  timestamps: bigint[];
  prices: bigint[];
};

export type SwapResult = {
  amount: bigint;
  spread: bigint;
  taxBaseIn: bigint;
};

export type PriceResult = {
  spotPriceBefore: bigint;
  spotPriceAfter: bigint;
  priceIn: bigint;
  priceOut: bigint;
};

export type GBMEstimation = {
  mean: bigint;
  variance: bigint;
  success: boolean;
};

export type TokenRecord = {
  decimals: bigint; // token decimals + oracle decimals
  balance: bigint;
  weight: bigint;
};

export type SwapParameters = {
  amount: bigint;
  fee: bigint;
  fallbackSpread: bigint;
};

export type JoinExitSwapParameters = {
  amount: bigint;
  fee: bigint;
  fallbackSpread: bigint;
  poolSupply: bigint;
};

export type GBMParameters = {
  z: bigint;
  horizon: bigint;
};
