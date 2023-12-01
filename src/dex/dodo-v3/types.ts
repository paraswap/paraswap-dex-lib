import { Address } from '../../types';

export type PoolState = {
  D3MMAddress: Address;
  depositedTokenList: Array<Address>;
};

export type D3VaultState = {
  tokenList: Array<Address>;
};

export type DodoV3Data = {
  exchange: Address;
};

export type DexParams = {
  D3Vault: Address;
  subgraphURL: string;
};

export type QuerySellOrBuyTokensResult = {
  payFromAmount: bigint;
  receiveToAmount: bigint;
  vusdAmount: bigint;
  swapFee: bigint;
  mtFee: bigint;
};
