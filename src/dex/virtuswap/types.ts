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

type RealPoolData = {
  isVirtual: false;
  path: [Address, Address];
};

type VirtualPoolData = {
  isVirtual: true;
  tokenOut: Address;
  commonToken: Address;
  ikPair: Address;
};

export type VirtuSwapData = RealPoolData | VirtualPoolData;

export type DexParams = {
  factoryAddress: Address;
  vPoolManagerAddress: Address;
  initCode: string;
  router: Address;
  isTimestampBased: boolean;
  realPoolGasCost: number;
  virtualPoolGasCost: number;
};
