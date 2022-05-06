import { Address, Token } from '../../types';

export type TokenInfo = {
  reserve: bigint;
  threshold: bigint;
  lastResetTimestamp: number;
  R: bigint;
  target: bigint;
};

export type TokenState = {
  priceNow: bigint;
  spreadNow: bigint;
  coeffNow: bigint;
};

export type PoolState = {
  feeRates: Record<string, bigint>;
  tokenInfos: Record<string, TokenInfo>;
  tokenStates: Record<string, TokenState>;
};

export type WooFiData = {
  // TODO: WooFiData is the dex data that is
  // returned by the API that can be used for
  // tx building. The data structure should be minimal.
  // Complete me!
  exchange: string;
};

export type DexParams = {
  wooPPAddress: string;
  woOracleAddress: string;
  wooFeeManagerAddress: string;
  quoteToken: Token;
  baseTokens: Record<string, Token>;
};
