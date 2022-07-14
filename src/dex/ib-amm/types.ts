import { ChainLinkState } from '../../lib/chainlink';
import { NumberAsString } from '../../types';

export type IbAmmPoolState = {
  chainlink: { [underlyingAddress: string]: ChainLinkState };
};

export type IbAmmData = {
  unitPrice: bigint;
};

export type IbAmmParams = [
  token: string,
  amount: NumberAsString,
  minOut: NumberAsString,
];

export enum IbAmmFunctions {
  buy = 'buy',
  sell = 'sell',
}

export type IbTokensInfo = {
  TOKEN_ADDRESS: string;
  FEED_ADDRESS: string;
  FEED_DECIMALS: number;
  AGGREGATOR_ADDRESS: string;
  TOKEN_SYMBOL: string;
};

export type IbAmmInfo = {
  IB_TOKENS: IbTokensInfo[];
  DAI: string;
  MIM: string;
  IBAMM_ADDRESS: string;
};
