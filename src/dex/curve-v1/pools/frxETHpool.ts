import { Address } from '../../../types';
import { IDexHelper } from '../../../dex-helper';
import { bigNumberify } from '../../../utils';
import StableSwapSTETH from '../../../abi/curve-v1/StableSwapSTETH.json';
import { ThreePool } from './3pool';

const pool = 'frxETH';
export const address: Address =
  '0xa1f8a6807c402e4a15ef4eba36528a3fed24e577'.toLowerCase();
const tokenAddress: Address = '0xf43211935c781d5ca1a41d2041f397b8a7366c7a';
const N_COINS: number = 2;
const PRECISION_MUL = ['1', '1'].map(bigNumberify);
const USE_LENDING = [false, false];
const COINS = [
  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  '0x5e8422345238f34275888049021821e8e08caa1f',
];
const trackCoins = true;

export class FRXETHPool extends ThreePool {
  constructor(parentName: string, dexHelper: IDexHelper) {
    super(
      parentName,
      dexHelper,
      pool,
      address,
      tokenAddress,
      trackCoins,
      StableSwapSTETH,
      N_COINS,
      PRECISION_MUL,
      USE_LENDING,
      COINS,
      'FRXETHPool',
    );
  }
}

