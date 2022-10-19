import { Interface } from '@ethersproject/abi';
import { Address } from '../../types';

export enum PriceHandlerTypes {
  PLAIN = 'plain',
}

export enum StateHandlerTypes {
  FACTORY_PLAIN = 'factory_plain'
}

export type ImplementationConstants = {
  // Take from implementations constants
  FEE_DENOMINATOR: bigint;
  PRECISION: bigint;
  LENDING_PRECISION: bigint;
};

export type PoolConstants = {
  // Request from contract or calculate on initialization
  COINS: Address[];
  BASE_COINS: Address[];
  N_COINS: bigint;
  coins_decimals: number[];
  base_coins_decimals: number[];
  rate_multipliers: bigint[];
} & ImplementationConstants;

export type PoolState = {
  A: bigint; // factory get_A()
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

export type FactoryImplementation = {
  address: Address;
  constants: ImplementationConstants;
  stateEntity: StateHandlerTypes;
  priceHandler: PriceHandlerTypes;
};

export type DexParams = {
  factoryAddress: string | null;
  pools: Record<string, PoolConfig>;
  factoryImplementations: Record<string, FactoryImplementation>;
};

export enum CurveSwapFunctions {
  exchange = 'exchange',
  exchange_underlying = 'exchange_underlying',
}

export type CurveV1Ifaces = {
  exchangeRouter: Interface;
  factory: Interface;
};
