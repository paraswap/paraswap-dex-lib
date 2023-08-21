import { Address, Token } from '../../types';
import { IntegralEventPool } from './integral-pool';

export type IntegralPoolState = {
  price: bigint;
  invertedPrice: bigint;
  fee: bigint;
  limits0: [bigint, bigint];
  limits1: [bigint, bigint];
};

export type IntegralData = {
  relayer: Address;
};

export type DexParams = {
  relayerAddress: string;
  subgraphURL?: string;
};

export type IntegralPair = {
  token0: Token;
  token1: Token;
  pool?: IntegralEventPool;
};

export enum IntegralFunctions {
  swap = 'sell',
  buy = 'buy',
}
