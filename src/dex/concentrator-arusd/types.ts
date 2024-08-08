import { Address } from '../../types';

export type ConcentratorArusdState = {
  totalSupply: string;
  totalAssets: string;
};
export type ConcentratorArusdNavState = {
  nav: string;
};
export type ConcentratorArusdData = {};

export type DexParams = {
  arUSDAddress: Address;
  rUSDAddress: Address;
  arUSD5115Address: Address;
};
