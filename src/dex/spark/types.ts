import { Interface } from '@ethersproject/abi';
import { Address } from '../../types';

export type SparkData = { exchange: Address };

export type SparkParams = {
  sdaiAddress: Address;
  daiAddress: Address;
  potAddress: Address;
  savingsRate: {
    symbol: 'dsr' | 'ssr';
    topic: string;
  };
  poolInterface: Interface;
  exchangeInterface: Interface;
  swapFunctions: typeof SparkSDaiFunctions | typeof SparkSUSDSFunctions;
  referralCode: null | string;
};

export enum SparkSDaiFunctions {
  deposit = 'deposit',
  redeem = 'redeem',
  withdraw = 'withdraw',
  mint = 'mint',
}

export enum SparkSUSDSFunctions {
  deposit = 'deposit(uint256,address,uint16)',
  redeem = 'redeem',
  withdraw = 'withdraw',
  mint = 'mint(uint256,address,uint16)',
}

export type SparkSDaiPoolState = {
  rho: string;
  chi: string;
  dsr: string;
  live: boolean;
};
