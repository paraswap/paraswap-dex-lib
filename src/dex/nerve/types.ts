import type { DeepReadonly } from 'ts-essentials';
import type { BlockHeader } from 'web3-eth';
import type { Address, Log } from '../../types';
import type { NerveEventMetapool } from './nerve-metapool';
import type { NerveEventPool } from './nerve-pool';

export interface PoolState {
  initialA: bigint;
  futureA: bigint;
  initialATime: bigint;
  futureATime: bigint;
  swapFee: bigint;
  adminFee: bigint;
  defaultDepositFee: bigint;
  defaultWithdrawFee: bigint;
  lpToken_supply: bigint;
  balances: bigint[];
  tokenPrecisionMultipliers: bigint[];
  isValid: boolean;
}

export type MetapoolState = PoolState & {
  baseVirtualPrice: bigint;
  baseCacheLastUpdated: bigint;
  basePool: PoolState;
};

export interface NervePoolConfig {
  coins: Address[];
  address: Address;
  name: string;
  isMetapool: boolean;
  lpTokenAddress: string;
  trackCoins: boolean;
}

export type NerveData = {
  // TODO: NerveData is the dex data that is
  // returned by the API that can be used for
  // tx building. The data structure should be minimal.
  // Complete me!
};

export type DexParams = {
  poolConfigs: Record<string, NervePoolConfig>;
};

export type AdapterMappings = {
  [side: string]: { name: string; index: number }[];
};

export type EventHandler<S> = (
  event: any,
  pool: S,
  log: Log,
  blockHeader: BlockHeader,
) => DeepReadonly<S>;

export type EventPoolOrMetapool = NerveEventPool | NerveEventMetapool;

export type PoolOrMetapoolState = PoolState | MetapoolState;

export type EventPoolMappings = { [pool: string]: EventPoolOrMetapool };

export type NotEventPoolMappings = {
  [pool: string]: { state?: PoolOrMetapoolState; config: NervePoolConfig };
};
