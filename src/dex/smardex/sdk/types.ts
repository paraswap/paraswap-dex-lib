import { TradeType } from './constants';

export interface Pair {
  address?: string;
  token0: string;
  token1: string;
  reserve0: bigint;
  reserve1: bigint;
  reserve0LastFictive: bigint;
  reserve1LastFictive: bigint;
  priceAverageLastTimestamp: number;
  priceAverage0: bigint;
  priceAverage1: bigint;
  forcedPriceAverageTimestamp?: number;
  prevReserveFic0?: bigint;
  prevReserveFic1?: bigint;
  feesLP: bigint;
  feesPool: bigint;
}

export interface CurrencyAmount {
  currency: string;
  amount: bigint;
  amountMax?: bigint;
  newRes0?: bigint;
  newRes1?: bigint;
  newRes0Fic?: bigint;
  newRes1Fic?: bigint;
  newPriceAverage0?: bigint;
  newPriceAverage1?: bigint;
  forcedPriceAverageTimestamp?: number;
}

export interface BestTradeOptions {
  maxNumResults?: number; // how many results to return
  maxHops?: number; // the maximum number of hops for the swap
  arbitrage?: boolean; // consider arbitrage loops or not
}

export interface Route {
  pairs: Pair[];
  path: string[];
  input: string;
  output: string;
}

export interface Trade {
  route: Route;
  amountIn: CurrencyAmount;
  amountOut: CurrencyAmount;
  tradeType: TradeType;
  priceImpact?: bigint;
  gasFeesUSD?: bigint;
  amountInUSD?: bigint;
  amountOutUSD?: bigint;
}

export interface GasEstimateData {
  gasPrice: bigint;
  gasQuantitiesFirstHop: number;
  gasQuantitiesAdditionalHop: number;
  nativeTokenPrice: bigint;
  nativeTokenDecimals: number;
  inputTokenPrice: bigint;
  inputTokenDecimals: number;
  outputTokenPrice: bigint;
  outputTokenDecimals: number;
}
