import { Address } from '../../../types';
import { ThreePool } from './3pool';
import StableSwapRen from '../../../abi/curve/StableSwapRen.json';
import { IDexHelper } from '../../../dex-helper';
import { bigNumberify } from '../../../utils';

const pool = 'ren';
export const address: Address =
  '0x93054188d876f558f4a66B2EF1d97d16eDf0895B'.toLowerCase();
const tokenAddress: Address = '0x49849C98ae39Fff122806C06791Fa73784FB3675';
const N_COINS: number = 2;
const PRECISION_MUL = ['10000000000', '10000000000'].map(bigNumberify);
// This is incorrect but as the rates of renBTC is set to 1e18, we just assume it will not change.
const USE_LENDING = [false, false];
const COINS = [
  '0xeb4c2781e4eba804ce9a9803c67d0893436bb27d',
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
];
const trackCoins = true;

export class RenPool extends ThreePool {
  constructor(parentName: string, dexHelper: IDexHelper) {
    super(
      parentName,
      dexHelper,
      pool,
      address,
      tokenAddress,
      trackCoins,
      StableSwapRen,
      N_COINS,
      PRECISION_MUL,
      USE_LENDING,
      COINS,
      'RenPool',
    );
  }
}
