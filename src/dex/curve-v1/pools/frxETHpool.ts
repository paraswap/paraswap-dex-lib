import { Address } from '../../../types';
import { IDexHelper } from '../../../dex-helper';
import { bigNumberify } from '../../../utils';
import { CurvePool } from './curve-pool';
import StableSwap3Pool from '../../../abi/curve-v1/StableSwap3Pool.json';

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

export class FRXETHPool extends CurvePool {
  constructor(
    parentName: string,
    dexHelper: IDexHelper,
    _pool = pool,
    _address = address,
    _tokenAddress = tokenAddress,
    _trackCoins = trackCoins,
    _abi: any = StableSwap3Pool,
    _N_COINS = N_COINS,
    _PRECISION_MUL = PRECISION_MUL,
    _USE_LENDING = USE_LENDING,
    _COINS = COINS,
    prefix = 'frxETH',
  ) {
    super(
      parentName,
      dexHelper,
      dexHelper.getLogger(prefix),
      _pool,
      _address,
      _tokenAddress,
      _trackCoins,
      _abi,
      _N_COINS,
      _PRECISION_MUL,
      _USE_LENDING,
      _COINS,
    );
  }
}
