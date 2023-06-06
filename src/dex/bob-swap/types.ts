import { Address, Token } from '../../types';
import { BigNumber } from 'ethers';

export type CollateralInfo = {
  inFee: bigint;
  outFee: bigint;
  price: bigint;
  balance: bigint;
  maxBalance: bigint;
};

export type PoolState = {
  collaterals: Record<Address, CollateralInfo>;
};

export type DecodedCollateralStateLegacy = {
  balance: BigNumber;
  buffer: BigNumber;
  dust: BigNumber;
  yield: Address;
  price: BigNumber;
  inFee: BigNumber;
  outFee: BigNumber;
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
  bobSwapAddress: Address;
  bobTokenAddress: Address;
  tokens: Array<Token>;
};
