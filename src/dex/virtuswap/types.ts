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
  rRatio: bigint;
  reserves: Record<Address, { balance: bigint; baseValue: bigint }>;
};

export type VirtualPoolTokens = {
  jk0: Address;
  jk1: Address;
  ik0: Address;
  ik1: Address;
};

type GenericVirtualPoolState<TPair extends Address | PoolState> = {
  fee: number;
  token0: Address;
  token1: Address;
  balance0: bigint;
  balance1: bigint;
  commonToken: Address;
  jkPair: TPair;
  ikPair: TPair;
};

export type VirtualPoolState = GenericVirtualPoolState<PoolState>;

export type PlainVirtualPoolState = GenericVirtualPoolState<Address>;

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
  vPoolManagerAddress: Address;
  initCode: string;
  router: Address;
  isTimestampBased: boolean;
};
