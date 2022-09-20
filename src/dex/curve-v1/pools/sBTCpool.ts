import { Address } from '../../../types';
import { ThreePool } from './3pool';
import StableSwapSBTC from '../../../abi/curve/StableSwapSBTC.json';
import { IDexHelper } from '../../../dex-helper';
import { bignumberify } from '../../../utils';

const pool = 'sBTC';
export const address: Address =
  '0x7fC77b5c7614E1533320Ea6DDc2Eb61fa00A9714'.toLowerCase();
const tokenAddress: Address = '0x075b1bb99792c9E1041bA13afEf80C91a1e70fB3';
const N_COINS: number = 3;
const PRECISION_MUL = ['10000000000', '10000000000', '1'].map(bignumberify);
const USE_LENDING = [false, false, false];
const COINS = [
  '0xeb4c2781e4eba804ce9a9803c67d0893436bb27d',
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
  '0xfe18be6b3bd88a2d2a7f928d00292e7a9963cfc6',
];
const trackCoins = true;

export class SBTCPool extends ThreePool {
  constructor(parentName: string, dexHelper: IDexHelper) {
    super(
      parentName,
      dexHelper,
      pool,
      address,
      tokenAddress,
      trackCoins,
      StableSwapSBTC,
      N_COINS,
      PRECISION_MUL,
      USE_LENDING,
      COINS,
      'SBTCPool',
    );
  }
}
