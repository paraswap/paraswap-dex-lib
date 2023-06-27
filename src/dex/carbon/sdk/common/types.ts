export { PayableOverrides, PopulatedTransaction } from 'ethers';
import { BigNumber } from '../utils/numerics';

export type RetypeProps<T, From, To> = {
  [K in keyof T]: T[K] extends From
    ? To
    : T[K] extends object
    ? RetypeProps<T[K], From, To>
    : T[K];
};

export type RetypeBigNumberToString<T> = RetypeProps<T, BigNumber, string>;

export type Rate = {
  input: BigNumber;
  output: BigNumber;
};

export type RateBNStr = RetypeBigNumberToString<Rate>;

export type Quote = {
  id: BigNumber;
  rate: Rate;
};

export type QuoteBNStr = RetypeBigNumberToString<Quote>;

export type TradeAction = {
  strategyId: BigNumber;
  amount: BigNumber;
};

export type TradeActionBNStr = RetypeBigNumberToString<TradeAction>;

export type Filter = (rate: Rate) => boolean;

export enum MatchType {
  Fast = 'Fast',
  Best = 'Best',
}

export type MatchAction = {
  id: BigNumber;
  input: BigNumber;
  output: BigNumber;
};

export type MatchActionBNStr = RetypeBigNumberToString<MatchAction>;

export type MatchOptions = {
  [key in MatchType]?: MatchAction[];
};

export type MatchOptionsBNStr = RetypeBigNumberToString<MatchOptions>;

export type TokenPair = [string, string];

export type EncodedOrder = {
  y: BigNumber;
  z: BigNumber;
  A: BigNumber;
  B: BigNumber;
};

export type EncodedOrderBNStr = RetypeBigNumberToString<EncodedOrder>;

export type DecodedOrder = {
  liquidity: string;
  lowestRate: string;
  highestRate: string;
  marginalRate: string;
};

export type OrdersMap = {
  [orderId: string]: EncodedOrder;
};

export type OrdersMapBNStr = RetypeBigNumberToString<OrdersMap>;

export type EncodedStrategy = {
  id: BigNumber;
  token0: string;
  token1: string;
  order0: EncodedOrder;
  order1: EncodedOrder;
};

export type EncodedStrategyBNStr = RetypeBigNumberToString<EncodedStrategy>;

export type DecodedStrategy = {
  token0: string;
  token1: string;
  order0: DecodedOrder;
  order1: DecodedOrder;
};

export type TradeData = {
  trader: string;
  sourceToken: string;
  targetToken: string;
  sourceAmount: string;
  targetAmount: string;
  tradingFeeAmount: string;
  byTargetAmount: boolean;
};

export type Action = {
  id: string;
  sourceAmount: string;
  targetAmount: string;
};

/**
 * A token resolution buy-sell trading strategy for a pair of tokens.
 */
export type Strategy = {
  id: string;
  baseToken: string;
  quoteToken: string;
  buyPriceLow: string; // in quote tkn per 1 base tkn
  buyPriceHigh: string; // in quote tkn per 1 base tkn
  buyBudget: string; // in quote tkn
  sellPriceLow: string; // in quote tkn per 1 base tkn
  sellPriceHigh: string; // in quote tkn per 1 base tkn
  sellBudget: string; // in base tkn
  encoded: EncodedStrategyBNStr; // the encoded strategy
};

export type AtLeastOneOf<T> = {
  [K in keyof T]: { [key in K]: T[K] } & {
    [key in Exclude<keyof T, K>]?: T[key];
  };
}[keyof T];

export type StrategyUpdate = AtLeastOneOf<
  Omit<Strategy, 'id' | 'encoded' | 'baseToken' | 'quoteToken'>
>;

export type BlockMetadata = {
  number: number;
  hash: string;
};

export interface Fetcher {
  pairs(): Promise<TokenPair[]>;
  strategiesByPair(token0: string, token1: string): Promise<EncodedStrategy[]>;
  getLatestStrategyCreatedStrategies(
    fromBlock: number,
    toBlock: number,
  ): Promise<EncodedStrategy[]>;
  getLatestStrategyUpdatedStrategies(
    fromBlock: number,
    toBlock: number,
  ): Promise<EncodedStrategy[]>;
  getLatestStrategyDeletedStrategies(
    fromBlock: number,
    toBlock: number,
  ): Promise<EncodedStrategy[]>;
  getLatestTokensTradedTrades(
    fromBlock: number,
    toBlock: number,
  ): Promise<TradeData[]>;
  getBlockNumber(): Promise<number>;
  tradingFeePPM(): Promise<number>;
  onTradingFeePPMUpdated(
    listener: (prevFeePPM: number, newFeePPM: number) => void,
  ): void;
  getBlock(blockNumber: number): Promise<BlockMetadata>;
}
