import { Address } from '../../types';

export type SDaiData = null;

export type SDaiParams = {
  sdaiAddress: Address;
  daiAddress: Address;
  potAddress: Address;
};

export enum SDaiFunctions {
  deposit = 'deposit',
  redeem = 'redeem',
}

export type SDaiPoolState = {
  rho: string;
  chi: string;
  dsr: string;
};
