import { NumberAsString } from '@paraswap/core';
import { Address, Token } from '../../types';

export type CurveV1Data = {
  exchange: Address;
  i: number;
  j: number;
  underlyingSwap: boolean;
  deadline: number;
  isApproved?: boolean;
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

export type DirectCurveParam = [
  fromToken: Address,
  toToken: Address,
  poolAddress: Address,
  fromAmount: NumberAsString,
  toAmount: NumberAsString,
  expectedAmount: NumberAsString,
  feePercent: NumberAsString,
  i: NumberAsString,
  j: NumberAsString,
  partner: Address,
  isApproved: boolean,
  beneficiary: Address,
  underlyingSwap: boolean,
  curveV1Swap: boolean,
  stEthSwap: boolean,
  permit: string,
  uuid: string,
];
