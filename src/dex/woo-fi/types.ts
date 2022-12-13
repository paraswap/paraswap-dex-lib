import { Address, Token } from '../../types';

export type TokenInfo = {
  reserve: bigint;
  R: bigint;
  threshold: bigint;
  target: bigint;
  lastResetTimestamp: bigint;
};

export type TokenState = {
  priceNow: bigint;
  spreadNow: bigint;
  coeffNow: bigint;
};

export type RefInfo = {
  chainlinkRefOracle: Address;
  refPriceFixCoeff: bigint;
  minInputAmount: bigint;
  maxInputAmount: bigint;
  bound: bigint;
};

export type LatestRoundData = {
  answer: bigint;
};

export type PoolState = {
  feeRates: Record<Address, bigint>;
  tokenInfos: Record<Address, TokenInfo>;
  tokenStates: Record<Address, TokenState>;
  oracleTimestamp: bigint;
  isPaused: boolean;
  guardian: {
    globalBound: bigint;
    refInfos: Record<Address, RefInfo>;
  };
  chainlink: {
    latestRoundDatas: Record<Address, LatestRoundData>;
  };
  wooPPBalances: Record<Address, bigint>;
};

export type WooFiData = {};

export type DexParams = {
  wooPPAddress: Address;
  wooOracleAddress: Address;
  wooFeeManagerAddress: Address;
  wooGuardianAddress: Address;
  quoteToken: Token;
  baseTokens: Record<string, Token>;
  rebateTo: Address;
};
