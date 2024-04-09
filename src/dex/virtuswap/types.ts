import { Address } from '../../types';
import { AsyncOrSync } from 'ts-essentials';

export type PoolState = {
  token0: Address;
  token1: Address;
  pairBalance0: bigint;
  pairBalance1: bigint;
  fee: number;
  vFee: number;
  lastSwapBlock: number;
  blocksDelay: number;
  reservesBaseValueSum: bigint;
  maxReserveRatio: bigint;
  reserves: Record<Address, { balance: bigint; baseValue: bigint }>;
};

export type FactoryState = {
  pools: Address[];
};

export type OnPoolCreatedCallback = (
  pool: Address,
  blockNumber: number,
) => AsyncOrSync<void>;

export type VirtuSwapData = {
  // TODO: VirtuSwapData is the dex data that is
  // returned by the API that can be used for
  // tx building. The data structure should be minimal.
  // Complete me!
  exchange: Address;
};

export type DexParams = {
  // TODO: DexParams is set of parameters the can
  // be used to initiate a DEX fork.
  factoryAddress: Address;
  initCode: string;
  router: Address;
  isTimestampBased: boolean;
};
