import { Address } from '../../types';

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
}

export type MetapoolState = PoolState & {
  baseVirtualPrice: bigint;
  baseCacheLastUpdated: bigint;
  basePoolState: PoolState;
};

export interface NervePoolConfig {
  coins: Address[];
  address: Address;
  name: string;
  type: number; // 1: stable coin pool, 2: others pools
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
  // TODO: DexParams is set of parameters the can
  // be used to initiate a DEX fork.
  // Complete me!
};
