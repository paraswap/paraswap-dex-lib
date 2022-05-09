import { Address, Token } from '../../types';

export type TokenInfo = {
  reserve: bigint;
  R: bigint;
  threshold: bigint;
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
};

export type WooFiData = {
  // TODO: WooFiData is the dex data that is
  // returned by the API that can be used for
  // tx building. The data structure should be minimal.
  // Complete me!
  exchange: Address;
};

export type DexParams = {
  wooPPAddress: Address;
  woOracleAddress: Address;
  wooFeeManagerAddress: Address;
  quoteToken: Token;
  baseTokens: Record<Address, Token>;
};
