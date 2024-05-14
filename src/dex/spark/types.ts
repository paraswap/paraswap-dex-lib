import { Address } from '../../types';

export type SparkData = { exchange: Address };

export type SparkParams = {
  sdaiAddress: Address;
  daiAddress: Address;
  potAddress: Address;
};

export enum SparkSDaiFunctions {
  deposit = 'deposit',
  redeem = 'redeem',
  withdraw = 'withdraw',
  mint = 'mint',
}

export type SparkSDaiPoolState = {
  rho: string;
  chi: string;
  dsr: string;
  live: boolean;
};
