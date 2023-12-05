import { Address, NumberAsString } from '../../types';
import BigNumber from 'bignumber.js';

export type PoolState = {
  D3MMAddress: Address;
  depositedTokenList: Array<Address>;
};

export type D3VaultState = {
  tokenList: Array<Address>;
};

export type DodoV3Data = {
  exchange: Address;
  slippageFactor?: BigNumber;
};

export type DexParams = {
  D3Proxy: Address;
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

export enum D3ProxyFunctions {
  buyTokens = 'buyTokens',
  sellTokens = 'sellTokens',
}

export type D3MMsellTokenParams = {
  to: Address;
  fromToken: Address;
  toToken: Address;
  fromAmount: NumberAsString;
  minReceiveAmount: NumberAsString;
  data: string;
};

export type D3ProxySwapTokensParams = [
  pool: Address,
  to: Address,
  fromToken: Address,
  toToken: Address,
  fromAmount: NumberAsString,
  minReceiveAmount: NumberAsString,
  data: string,
  deadLine: string,
];
