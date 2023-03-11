import { Address, Token } from '../../types';

export type CurveV1Data = {
  exchange: Address;
  i: number;
  j: number;
  underlyingSwap: boolean;
  deadline: number;
};

export type PoolConfig = {
  underlying: string[];
  coins: string[];
  address: string;
  name: string;
  type: number; // 1: stable coin pool, 2: others pools
  version: number;
  isLending: boolean;
  isMetapool: boolean;
  baseToken?: string;
  liquidityUSD?: number;
  precisionMul?: string[];
  tokenAddress?: string;
  trackCoins?: boolean;
  useLending?: boolean[];
  isFeeOnTransferSupported?: boolean;
  isPaused?: boolean;
};

export type TokenWithReasonableVolume = Token & {
  reasonableVolume: bigint;
  tokenPrice?: number;
};

export type DexParams = {
  baseTokens: Record<string, TokenWithReasonableVolume>;
  eventSupportedPools: string[];
  pools: Record<string, PoolConfig>;
  disableFeeOnTransferTokenAddresses?: Set<string>;
};

export enum CurveSwapFunctions {
  exchange = 'exchange',
  exchange_underlying = 'exchange_underlying',
}
