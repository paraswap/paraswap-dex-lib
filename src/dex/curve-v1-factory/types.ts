import { Interface } from '@ethersproject/abi';
import { Address } from '../../types';

export type PoolContextConstants = {
  BASE_IMPLEMENTATION_NAME?: ImplementationNames;

  N_COINS: number;
  BI_N_COINS: bigint;

  FEE_DENOMINATOR: bigint;
  PRECISION: bigint;

  // Optional: not all pools have it or need it. I would like to solve this making
  // infer the type from ImplementationName, but couldn't solve the task in reasonable time
  // So, I had to make runtime type checks for undefined in places where we need that values
  // At least, errors are not going to slip through unnoticed if we forgot to specify some constants,
  // but ideally I would prefer to have TS to check that kind of issues
  PRECISION_MUL?: bigint[];
  LENDING_PRECISION?: bigint;
  A_PRECISION?: bigint;
  USE_LENDING?: boolean[];
  RATES?: bigint[];
  MAX_COIN?: number;
  BASE_N_COINS?: number;
};

export type PoolConstants = {
  COINS: Address[]; // factory get_coins()
  coins_decimals: number[]; // factory get_decimals()
  rate_multipliers: bigint[]; // calculated from decimals
  lpTokenAddress?: Address; // from config
};

export type PoolState = {
  A: bigint; // factory get_A()
  balances: bigint[]; // factory get_balances()
  fee: bigint; // factory get_fees()
  constants: PoolConstants;
  virtualPrice?: bigint; // from custom plain pool: get_virtual_price()
  totalSupply?: bigint; // from lpToken -> totalSupply()
  exchangeRateCurrent?: (bigint | undefined)[]; // from cToken -> exchangeRateCurrent()
  basePoolState?: PoolState;
};

export type PoolStateWithUpdateInfo<T> = {
  blockNumber: number;
  lastUpdatedAt: number;
  poolState: T;
};

export type CurveV1FactoryData = {
  exchange: Address;
  i: number;
  j: number;
  underlyingSwap: boolean;
};

export enum FactoryImplementationNames {
  FACTORY_META_3POOL_2_8 = 'factory_meta_3pool_2_8',
  FACTORY_META_3POOL_2_15 = 'factory_meta_3pool_2_15',
  FACTORY_META_3POOL_FEE_TRANSFER = 'factory_meta_3pool_fee_transfer',
  FACTORY_META_BTC = 'factory_meta_btc',
  FACTORY_META_FRAX = 'factory_meta_frax',

  FACTORY_PLAIN_2COIN_ERC20 = 'factory_plain_2coin_erc20',
  FACTORY_PLAIN_2COIN_ERC20_18DEC = 'factory_plain_2coin_erc20_18dec', // 18DEC = 18 decimals
  FACTORY_PLAIN_2COIN_ERC20_FEE_TRANSFER = 'factory_plain_2coin_erc20_fee_transfer',
  FACTORY_PLAIN_2COIN_NATIVE = 'factory_plain_2coin_native',

  FACTORY_PLAIN_3COIN_ERC20 = 'factory_plain_3coin_erc20',
  FACTORY_PLAIN_3COIN_ERC20_18DEC = 'factory_plain_3coin_erc20_18dec',
  FACTORY_PLAIN_3COIN_ERC20_FEE_TRANSFER = 'factory_plain_3coin_erc20_fee_transfer',

  FACTORY_PLAIN_4COIN_ERC20 = 'factory_plain_4coin_erc20',
  FACTORY_PLAIN_4COIN_ERC20_18DEC = 'factory_plain_4coin_erc20_18dec',
}

export enum CustomImplementationNames {
  CUSTOM_PLAIN_3COIN_BTC = 'custom_plain_3coin_btc',
  CUSTOM_PLAIN_2COIN_FRAX = 'custom_plain_2coin_frax',
  CUSTOM_PLAIN_3COIN_THREE = 'custom_plain_3coin_three',
}

export const ImplementationNames = {
  ...CustomImplementationNames,
  ...FactoryImplementationNames,
};
export type ImplementationNames =
  | CustomImplementationNames
  | FactoryImplementationNames;

export type FactoryPoolImplementations = {
  name: FactoryImplementationNames;
  address: Address;
  isFeeOnTransferSupported: boolean;
  // For now I put everywhere false, but eventually we should have more granular handling
  // for all pools
  isWrapNative: boolean;
  basePoolAddress?: Address;
};

export type CustomPoolConfig = {
  name: CustomImplementationNames;
  address: Address;
  isWrapNative: boolean;
  lpTokenAddress: Address;
};

export type DexParams = {
  factoryAddress: string | null;
  stateUpdateFrequencyMs: number;
  factoryPoolImplementations: Record<Address, FactoryPoolImplementations>;
  customPools: Record<string, CustomPoolConfig>;
};

export enum CurveSwapFunctions {
  exchange = 'exchange',
  exchange_underlying = 'exchange_underlying',
}

export type CurveV1FactoryIfaces = {
  exchangeRouter: Interface;
  factory: Interface;
  erc20: Interface;
  threePool: Interface;
};
