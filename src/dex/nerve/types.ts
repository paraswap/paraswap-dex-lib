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
}
