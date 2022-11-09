import { Interface } from '@ethersproject/abi';
import { Address } from '../../types';

// The difference between PoolContextConstants and PoolConstants lies in the fact
// that PoolContextConstants can not be requested from RPC. They are hardcoded
// never be changed. Contrary PoolConstants may change or may be initialized with different values
// for different addresses or chains

export type PoolContextConstants = {
  // These are not actually context relevant fro pricing constants, but helpful in identifying different
  // aspects of implementation
  isFeeOnTransferSupported: boolean;
  // For now I put everywhere false, but eventually we should have more granular handling
  // for all pools
  isWrapNative: boolean;
  isLending: boolean;

  // Starting from this point, constants are context relevant for pricing

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
  offpeg_fee_multiplier?: bigint; // from pool
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
  // Mapping names I took from here:
  // https://github.com/curvefi/curve-api/blob/ae000317722aec94c7cff7c9a09f3bb6e8c9a3f8/constants/configs.js#L20
  // FACTORY_ - and later their name in upper case separated with underscore

  FACTORY_V1_META_BTC = 'factory_v1_meta_btc',
  FACTORY_V1_META_USD = 'factory_v1_meta_usd',

  FACTORY_META_BTC = 'factory_meta_btc',
  FACTORY_META_BTC_BALANCES = 'factory_meta_btc_balances',

  FACTORY_META_BTC_REN = 'factory_meta_btc_ren',
  FACTORY_META_BTC_BALANCES_REN = 'factory_meta_btc_balances_ren',

  FACTORY_META_USD = 'factory_meta_usd',
  FACTORY_META_USD_BALANCES = 'factory_meta_usd_balances',

  FACTORY_META_USD_FRAX_USDC = 'factory_meta_usd_frax_usdc',
  FACTORY_META_USD_BALANCES_FRAX_USDC = 'factory_meta_usd_balances_frax_usdc',

  FACTORY_PLAIN_2_BALANCES = 'factory_plain_2_balances',
  FACTORY_PLAIN_2_BASIC = 'factory_plain_2_basic',
  FACTORY_PLAIN_2_ETH = 'factory_plain_2_eth',
  FACTORY_PLAIN_2_OPTIMIZED = 'factory_plain_2_optimized',

  FACTORY_PLAIN_3_BALANCES = 'factory_plain_3_balances',
  FACTORY_PLAIN_3_BASIC = 'factory_plain_3_basic',
  FACTORY_PLAIN_3_ETH = 'factory_plain_3_eth',
  FACTORY_PLAIN_3_OPTIMIZED = 'factory_plain_3_optimized',

  FACTORY_PLAIN_4_BALANCES = 'factory_plain_4_balances',
  FACTORY_PLAIN_4_BASIC = 'factory_plain_4_basic',
  FACTORY_PLAIN_4_ETH = 'factory_plain_4_eth',
  FACTORY_PLAIN_4_OPTIMIZED = 'factory_plain_4_optimized',
}

export enum CustomImplementationNames {
  CUSTOM_PLAIN_2COIN_FRAX = 'custom_plain_2coin_frax',
  CUSTOM_PLAIN_2COIN_RENBTC = 'custom_plain_2coin_renbtc',
  CUSTOM_PLAIN_3COIN_SBTC = 'custom_plain_3coin_sbtc',
  CUSTOM_PLAIN_3COIN_THREE = 'custom_plain_3coin_three',

  CUSTOM_ARBITRUM_2COIN_USD = 'custom_arbitrum_2coin_usd',
  CUSTOM_ARBITRUM_2COIN_BTC = 'custom_arbitrum_2coin_btc',

  CUSTOM_AVALANCHE_3COIN_LENDING = 'custom_avalanche_3coin_lending',

  CUSTOM_FANTOM_2COIN_USD = 'custom_fantom_2coin_usd',
  CUSTOM_FANTOM_2COIN_BTC = 'custom_fantom_2coin_btc',
  CUSTOM_FANTOM_3COIN_LENDING = 'custom_fantom_3coin_lending',

  CUSTOM_OPTIMISM_3COIN_USD = 'custom_optimism_3coin_usd',

  CUSTOM_POLYGON_2COIN_LENDING = 'custom_polygon_2coin_lending',
  CUSTOM_POLYGON_3COIN_LENDING = 'custom_polygon_3coin_lending',
}

// This is just a hack to blend to enums into one. One must blend actual values
// and then export type as well
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
  basePoolAddress?: Address;
};

export type CustomPoolConfig = {
  name: CustomImplementationNames | FactoryImplementationNames;
  address: Address;
  lpTokenAddress: Address;
  // Liquidity is fetched from curve API: https://api.curve.fi/api/getPools/ethereum/SLUG
  liquidityApiSlug: string;
  // There are some difference in input like uint128 or uint256
  // If we don't use proper type encoding we receive an error
  // You must specify what typ must be encoded/decoded for coins request
  coinsInputType: string;
  balancesInputType: string;
};

export type DexParams = {
  factoryAddress: string | null;
  stateUpdatePeriodMs: number;
  factoryPoolImplementations: Record<Address, FactoryPoolImplementations>;
  customPools: Record<string, CustomPoolConfig>;
  // Some pools are broken or self destructed. Took from here:
  // https://github.com/curvefi/curve-api/blob/ae000317722aec94c7cff7c9a09f3bb6e8c9a3f8/constants/configs.js#L92
  disabledPools: Set<Address>;
  disabledImplementations: Set<Address>;
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
