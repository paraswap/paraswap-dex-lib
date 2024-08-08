import { Address } from '../../types';

export type FxProtocolPoolState = {
  nav: string;
  redeemFee: string;
  weETHPrice: string;
};

export type FxProtocolData = {};

export type DexParams = {
  rUSDAddress: Address;
  weETHAddress: Address;
  rUSDWeETHMarketAddress: Address;
  weETHOracleAddress: Address;
};
