import { Interface } from '@ethersproject/abi';
import { Address } from '../../types';

export enum PriceHandlerTypes {
  PLAIN = 'plain',
}

export type PoolConstants = {
  COINS: Address[];
  N_COINS: bigint;
  PRECISION_MUL: bigint[];
  FEE_DENOMINATOR: bigint;
  RATES: bigint[];
  PRECISION: bigint;
  LENDING_PRECISION: bigint;
};

export type PoolState = {
  A: bigint; // factory get_A()-balances
  balances: bigint[]; // factory get_balances()
  fee: bigint; // factory get_fees()

  constants: PoolConstants;
};

export type PoolStateWithUpdateInfo<T> = {
  blockNumber: number;
  lastUpdatedAt: number;
  poolState: T;
};

export type CurveV1Data = {
  exchange: Address;
  i: number;
  j: number;
  underlyingSwap: boolean;
};

export type PoolConfig = {
  underlying: string[];
  coins: string[];
  address: string;
  name: string;
  isLending: boolean;
  isMetapool: boolean;
  liquidityUSD?: number;
  isFeeOnTransferSupported?: boolean;
};

export type DexParams = {
  factoryAddress: string | null;
  pools: Record<string, PoolConfig>;
};

export enum CurveSwapFunctions {
  exchange = 'exchange',
  exchange_underlying = 'exchange_underlying',
}

export type CurveV1Ifaces = {
  exchangeRouter: Interface;
};
