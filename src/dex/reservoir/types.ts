import { Address } from '../../types';

export enum ReservoirPoolTypes {
  ConstantProduct,
  Stable,
}

export type PoolState = {
  // TODO: poolState is the state of event
  // subscriber. This should be the minimum
  // set of parameters required to compute
  // pool prices. Complete me!
  reserve0: bigint;
  reserve1: bigint;
  curveId: ReservoirPoolTypes;
  swapFee: bigint;
};

export type ReservoirData = {
  // TODO: ReservoirFinanceData is the dex data that is
  // returned by the API that can be used for
  // tx building. The data structure should be minimal.
  // Complete me!
  router: Address;
  // denominated in basis points, should be a positive number
  slippage: bigint;
  // do we need the router here instead

  curveIds: ReservoirPoolTypes[];
  recipient: Address;
};

export type DexParams = {
  // TODO: DexParams is set of parameters the can
  // be used to initiate a DEX fork.
  // Complete me!
  subgraphURL?: string;
  factory: Address;
  router: Address;
};
