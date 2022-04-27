import { Address, NumberAsString } from '../../types';

export type PoolState = {
  // TODO: poolState is the state of event
  // subsrciber. This should be the minimum
  // set of parameters required to compute
  // pool prices. Complete me!
};

export type IbAmmData = {};

export type IbAmmParams = [
  token: string,
  amount: NumberAsString,
  minOut: NumberAsString,
];

export enum IbAmmFunctions {
  buy = 'buy',
  sell = 'sell',
}

export type DexParams = {
  IB_TOKENS: string[];
  DAI: string;
  MIM: string;
  IBAMM_ADDRESS: string;
};
