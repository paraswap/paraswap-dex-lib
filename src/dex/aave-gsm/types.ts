import { Address } from '../../types';

export type PoolState = {
  // TODO: poolState is the state of event
  // subscriber. This should be the minimum
  // set of parameters required to compute
  // pool prices. Complete me!
};

export type AaveGsmData = {
  // TODO: AaveGsmData is the dex data that is
  // returned by the API that can be used for
  // tx building. The data structure should be minimal.
  // Complete me!
  exchange: Address;
};

export type DexParams = {
  GSM_USDT: string;
  GSM_USDC: string;
  USDT: string;
  USDC: string;
  GHO: string;
};
