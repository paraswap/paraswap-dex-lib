import { Address } from '../../types';

export type WusdmPoolState = {
  totalShares: bigint;
  totalAssets: bigint;
};

export type WUSDMData = {
  exchange: string;
};

export enum WUSDMFunctions {
  deposit = 'deposit',
  redeem = 'redeem',
  withdraw = 'withdraw',
  mint = 'mint',
}

export type WusdmParams = {
  wUSDMAddress: Address;
  USDMAddress: Address;
};
