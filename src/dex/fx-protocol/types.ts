import { Address, Token } from '../../types';

export type PoolState = {
  // TODO: poolState is the state of event
  // subscriber. This should be the minimum
  // set of parameters required to compute
  // pool prices. Complete me!
  fNav: bigint;
  xNav: string;
  baseNav: bigint;
  collateralRatio: bigint;
};

export type FxProtocolData = {};

export type DexParams = {
  fETH: Address;
  xETH: Address;
  stETH: Address;
  market: Address;
};
