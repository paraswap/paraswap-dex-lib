import { JsonFragment } from '@ethersproject/abi';
import { Address, Token } from '../../types';

export type PoolState = {
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
  isValid: boolean;
};

export interface DFXPoolConfig {
  coins: Token[];
  address: Address;
  name: string;
  isMetapool: boolean;
  isUSDPool: boolean;
  lpToken: Token;
}

export type DfxData = {
  // TODO: DfxData is the dex data that is
  // returned by the API that can be used for
  // tx building. The data structure should be minimal.
  // Complete me!
  exchange: Address;
};

export type DexParams = {
  poolConfigs: Record<string, DFXPoolConfig>;
  abi: JsonFragment[];
  // TODO: DexParams is set of parameters the can
  // be used to initiate a DEX fork.
  // Complete me!
};
