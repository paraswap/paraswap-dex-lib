import { Address } from '../../types';

export type PoolState = {
  // TODO: poolState is the state of event
  // subscriber. This should be the minimum
  // set of parameters required to compute
  // pool prices. Complete me!
};

export type KyberswapElasticData = {
  // TODO: KyberswapElasticData is the dex data that is
  // returned by the API that can be used for
  // tx building. The data structure should be minimal.
  // Complete me!
  exchange: Address;
};

export type DexParams = {
  factory: Address;
  router: Address;
  positionManager: Address;
  quoter: Address;
  ticksFeesReader: Address;
  tokenPositionDescriptor: Address;
  supportedFees: bigint[];
  initHash: string;
  chunksCount: number;
  subgraphURL?: string;
};
