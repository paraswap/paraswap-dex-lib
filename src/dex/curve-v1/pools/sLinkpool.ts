import { Address } from '../../../types';
import { ThreePool } from './3pool';
import StableSwapSLINK from '../../../abi/curve-v1/StableSwapSLINK.json';
import { IDexHelper } from '../../../dex-helper';
import { bigNumberify } from '../../../utils';

const pool = 'SLINK';
export const address: Address =
  '0xf178c0b5bb7e7abf4e12a4838c7b7c5ba2c623c0'.toLowerCase();
const tokenAddress: Address = '0xcee60cfa923170e4f8204ae08b4fa6a3f5656f3a';
const N_COINS: number = 2;
const PRECISION_MUL = ['1', '1'].map(bigNumberify);
const USE_LENDING = [false, false];
const COINS = [
  '0x514910771af9ca656af840dff83e8264ecf986ca',
  '0xbbc455cb4f1b9e4bfc4b73970d360c8f032efee6',
];
const trackCoins = true;

export class SLINKPool extends ThreePool {
  constructor(parentName: string, dexHelper: IDexHelper) {
    super(
      parentName,
      dexHelper,
      pool,
      address,
      tokenAddress,
      trackCoins,
      StableSwapSLINK,
      N_COINS,
      PRECISION_MUL,
      USE_LENDING,
      COINS,
      'SLINKPool',
    );
  }
}
