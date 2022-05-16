import { JsonFragment } from '@ethersproject/abi';
import type { DeepReadonly } from 'ts-essentials';
import type { BlockHeader } from 'web3-eth';
import type { Address, Log, Token } from '../../types';
import type { NerveEventPool } from './nerve-pool';

export interface PoolState {
  initialA: bigint;
  futureA: bigint;
  initialATime: bigint;
  futureATime: bigint;
  swapFee: bigint;
  adminFee: bigint;
  defaultDepositFee?: bigint;
  defaultWithdrawFee?: bigint;
  lpToken_supply: bigint;
  balances: bigint[];
  tokenPrecisionMultipliers: bigint[];
  isValid: boolean;
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
