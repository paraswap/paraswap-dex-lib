import { Address } from '../../../types';
import { ThreePool } from './3pool';
import StableSwapHBTC from '../../../abi/curve-v1/StableSwapHBTC.json';
import { IDexHelper } from '../../../dex-helper';
import { bigNumberify } from '../../../utils';

const pool = 'hBTC';
export const address: Address =
  '0x4CA9b3063Ec5866A4B82E437059D2C43d1be596F'.toLowerCase();
const tokenAddress: Address = '0xb19059ebb43466C323583928285a49f558E572Fd';
const N_COINS: number = 2;
const PRECISION_MUL = ['1', '10000000000'].map(bigNumberify);
const USE_LENDING = [false, false];
const COINS = [
  '0x0316EB71485b0Ab14103307bf65a021042c6d380',
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
];
const trackCoins = true;

export class HBTCPool extends ThreePool {
  constructor(parentName: string, dexHelper: IDexHelper) {
    super(
      parentName,
      dexHelper,
      pool,
      address,
      tokenAddress,
      trackCoins,
      StableSwapHBTC,
      N_COINS,
      PRECISION_MUL,
      USE_LENDING,
      COINS,
      'HBTCPool',
    );
  }
}
