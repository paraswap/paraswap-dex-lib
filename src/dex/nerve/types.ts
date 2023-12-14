import { JsonFragment } from '@ethersproject/abi';
import type { DeepReadonly } from 'ts-essentials';
import type { BlockHeader } from 'web3-eth';
import type { Address, Log, Token } from '../../types';
import type { NerveEventPool } from './nerve-pool';

export interface PoolState {
  pool: string;
  blockTimestamp: bigint;
  fee: bigint;
  liquidity: bigint;
  balance0: bigint;
  balance1: bigint;
}

export interface NervePoolConfig {
  coins: Token[];
  address: Address;
  name: string;
  isMetapool: boolean;
  isUSDPool: boolean;
  lpToken: Token;
}

export type NerveData = {
  exchange: string;
  i: string;
  j: string;
  deadline: string;
};

export type OptimizedNerveData = NerveData;

export type NervePoolSwapParams = [
  i: string,
  j: string,
  dx: string,
  min_dy: string,
  deadline?: string,
];

export type DexParams = {
  poolConfigs: Record<string, NervePoolConfig>;
  abi: JsonFragment[];
};

export type EventHandler<S> = (
  event: any,
  pool: S,
  log: Log,
  blockHeader: BlockHeader,
) => DeepReadonly<S>;

export type EventPoolMappings = { [pool: string]: NerveEventPool };

export enum NervePoolFunctions {
  swap = 'swap',
}
