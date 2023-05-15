import { Address, Token } from '../../types';
import { BigNumber } from 'ethers';

export type CollateralInfo = {
  inFee: bigint;
  outFee: bigint;
  price: bigint;
  balance: bigint;
  maxBalance: bigint;
  decimals: number;
};

export type PoolState = {
  // TODO: poolState is the state of event
  // subscriber. This should be the minimum
  // set of parameters required to compute
  // pool prices. Complete me!
  collaterals: Record<Address, CollateralInfo>;
};

export type DecodedCollateralState = {
  balance: BigNumber;
  buffer: BigNumber;
  dust: BigNumber;
  yield: Address;
  price: BigNumber;
  inFee: BigNumber;
  outFee: BigNumber;
  maxBalance: BigNumber;
  maxInvested: BigNumber;
};

export type BobSwapData = {};

export type DexParams = {
  // TODO: DexParams is set of parameters the can
  // be used to initiate a DEX fork.
  // Complete me!
  bobSwapAddress: Address;
  bobTokenAddress: Address;
  tokens: Array<Token>;
};

export enum BobSwapFunctions {
  buy = 'buy',
  sell = 'sell',
  swap = 'swap',
}
