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

export type PoolState = {
  feeRates: Record<Address, bigint>;
  tokenInfos: Record<Address, TokenInfo>;
  tokenStates: Record<Address, TokenState>;
  oracleTimestamp: bigint;
};

export type WooFiData = {};

export type DexParams = {
  wooPPAddress: Address;
  wooOracleAddress: Address;
  wooFeeManagerAddress: Address;
  quoteToken: Token;
  baseTokens: Record<string, Token>;
};
