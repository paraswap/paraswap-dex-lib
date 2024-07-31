import { Address } from '../../types';

export type FxProtocolPoolState = {
  nav: bigint;
  redeemFee: bigint;
  weETHPrice: bigint;
};

export type FxProtocolData = {};

export type DexParams = {
  rUSDAddress: Address;
  weETHAddress: Address;
  rUSDWeETHMarketAddress: Address;
  weETHOracleAddress: Address;
};
