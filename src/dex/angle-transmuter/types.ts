import { BigNumber } from 'ethers';
import { Address, Token } from '../../types';
import { ChainLinkState } from '../../lib/chainlink';

export type PoolState = {
  stablecoin: Token;
  transmuter: TransmuterState;
  oracles: {
    chainlink: { [address: string]: ChainLinkState };
    pyth: PythState;
  };
};

export type CollateralState = {
  whitelist: { status: boolean; data: string };
  fees: Fees;
  stablecoinsIssued: number;
  config: Oracle;
};

export type TransmuterState = {
  collaterals: {
    [token: string]: CollateralState;
  };
  isWhitelisted: {
    [type: number]: Set<string>;
  };
  xRedemptionCurve: number[];
  yRedemptionCurve: number[];
  totalStablecoinIssued: number;
};

export type ChainlinkConfig = {
  [address: string]: { proxy: Address; aggregator: Address; decimals: number };
};

export type PythConfig = { proxy: Address; ids: string[] };

export type PoolConfig = {
  agEUR: Token;
  transmuter: Address;
  collaterals: Address[];
  oracles: {
    chainlink: ChainlinkConfig;
    backed: ChainlinkConfig;
    redstone: ChainlinkConfig;
    pyth: PythConfig;
  };
};

export type ChainlinkState = {
  answer: number;
  timestamp: number;
};

export type PythState = {
  [address: string]: {
    answer: number;
    expo: number;
    timestamp: number;
  };
};

export type AngleTransmuterData = {
  exchange: Address;
};

export type DexParams = {
  EURA: Token;
  transmuter: Address;
  pyth: Address;
};

export enum QuoteType {
  MintExactInput = 0,
  MintExactOutput = 1,
  BurnExactInput = 2,
  BurnExactOutput = 3,
}

export enum OracleReadType {
  CHAINLINK_FEEDS = 0,
  EXTERNAL = 1,
  NO_ORACLE = 2,
  STABLE = 3,
  WSTETH = 4,
  CBETH = 5,
  RETH = 6,
  SFRXETH = 7,
  PYTH = 8,
  MAX = 9,
  MORPHO_ORACLE = 10,
}

export enum OracleQuoteType {
  UNIT = 0,
  TARGET = 1,
}

export type Fees = {
  xFeeMint: number[];
  yFeeMint: number[];
  xFeeBurn: number[];
  yFeeBurn: number[];
};

export type Pyth = {
  pyth: Address;
  feedIds: string[];
  stalePeriods: number[];
  isMultiplied: number[];
  quoteType: OracleQuoteType;
};

export type Chainlink = {
  circuitChainlink: Address[];
  stalePeriods: number[];
  circuitChainIsMultiplied: number[];
  chainlinkDecimals: number[];
  quoteType: OracleQuoteType;
};

export type OracleFeed = {
  isChainlink: boolean;
  isPyth: boolean;
  chainlink?: Chainlink;
  pyth?: Pyth;
  otherContract?: Address;
};

export type Oracle = {
  oracleType: OracleReadType;
  targetType: OracleReadType;
  externalOracle?: Address;
  oracleFeed: OracleFeed;
  targetFeed: OracleFeed;
  hyperparameters: string;
};

export type DecodedOracleConfig = {
  oracleType: OracleReadType;
  targetType: OracleReadType;
  oracleData: string;
  targetData: string;
  hyperparameters: string;
};

export type OracleHyperparameter = {
  userDeviation: BigNumber;
  burnRatioDeviation: BigNumber;
};

export type DecodedStateMultiCallResultPythOracle = {
  price: BigNumber;
  conf: number;
  expo: number;
  publishTime: number;
};

export const BASE_9 = 1; // 1e9
export const BASE_12 = 1e3; // 1e12

export const MAX_BURN_FEE = 0.999; // 999_000_000
