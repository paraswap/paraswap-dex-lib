import { Address } from '../../../types';
import { IDexHelper } from '../../../dex-helper';
import { bigNumberify } from '../../../utils';
import { ThreePool } from './3pool';
import StableSwapWBETH from '../../../abi/curve-v1/StableSwapWBETH.json';

const pool = 'wbETH';
export const address: Address =
  '0xbfab6fa95e0091ed66058ad493189d2cb29385e6'.toLowerCase();
const tokenAddress: Address = '0xbfab6fa95e0091ed66058ad493189d2cb29385e6';
const N_COINS: number = 2;
const PRECISION_MUL = ['1', '1'].map(bigNumberify);
const USE_LENDING = [false, false];
const COINS = [
  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  '0xa2e3356610840701bdf5611a53974510ae27e2e1',
];
const trackCoins = true;

export class WBETHPool extends ThreePool {
  constructor(parentName: string, dexHelper: IDexHelper) {
    super(
      parentName,
      dexHelper,
      pool,
      address,
      tokenAddress,
      trackCoins,
      StableSwapWBETH,
      N_COINS,
      PRECISION_MUL,
      USE_LENDING,
      COINS,
      'WBETHPool',
    );
  }
}


