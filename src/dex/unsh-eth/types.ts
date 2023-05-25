import { Address } from '../../types';

export type UnshEthData = {};

export type DexParams = {
  supportedTokens: Address[];
  lsdVaultAddress: Address;
  vdAmmAddress: Address;
  unshETHZapAddress: Address;
  unshETHAddress: Address;
};

export enum UnshEthFunctions {
  swapEthToLsd = 'swapEthToLsd',
  swapLsdToEth = 'swapLsdToEth',
  swapLsdToLsd = 'swapLsdToLsd',
  depositLsd = 'deposit_lsd',
}
