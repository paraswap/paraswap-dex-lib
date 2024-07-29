import { Address } from '../../types';

export type ConcentratorArusdState = {
  totalSupply: bigint;
  totalAssets: bigint;
};
export type ConcentratorArusdNavState = {
  nav: bigint;
};
export type ConcentratorArusdData = {};

export type DexParams = {
  arUSDAddress: Address;
  rUSDAddress: Address;
  arUSD5115Address: Address;
};
