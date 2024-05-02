import { Address } from '../../types';

export type SDaiData = null;

export type DexParams = {
  sdaiAddress: Address;
  daiAddress: Address;
};

export enum SDaiFunctions {
  deposit = 'deposit',
  redeem = 'redeem',
}
