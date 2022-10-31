import { Address, Token } from '../../types';

export type TokenInfo = {
  reserve: bigint;
  feeRate: bigint;
};

export type TokenState = {
  price: bigint;
  spread: bigint;
  coeff: bigint;
};

export type Decimals = {
  priceDec: bigint;
  quoteDec: bigint;
  baseDec: bigint;
};

export type LatestRoundData = {
  answer: bigint;
};

export type PoolState = {
  // fetched from WooPPV2.tokenInfos(address baseToken) :
  // https://arbiscan.io/address/0x8693F9701D6DB361Fe9CC15Bc455Ef4366E39AE0
  tokenInfos: Record<Address, TokenInfo>;

  // fetched from WooracleV2.state(address baseToken)
  // https://arbiscan.io/address/0x962d37fb9d75fe1af9aab323727183e4eae1322d
  tokenStates: Record<Address, TokenState>;

  // fetched from WooPPV2.decimalInfo(address baseToken)
  // https://arbiscan.io/address/0x8693F9701D6DB361Fe9CC15Bc455Ef4366E39AE0
  decimals: Record<Address, Decimals>;
  oracleTimestamp: bigint;
  isPaused: boolean;
};

export type WooFiV2Data = {};

// WooPP V2 for Arbitrum
// WooPPV2:     https://arbiscan.io/address/0x8693F9701D6DB361Fe9CC15Bc455Ef4366E39AE0
// WooracleV2:  https://arbiscan.io/address/0x962d37fb9d75fe1af9aab323727183e4eae1322d
// quote & base token info: in file `config.ts`
export type DexParams = {
  wooPPV2Address: Address;
  wooOracleAddress: Address;
  quoteToken: Token;
  baseTokens: Record<string, Token>;
  rebateTo: Address;
};
