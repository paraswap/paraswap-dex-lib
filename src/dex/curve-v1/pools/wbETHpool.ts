import { Address } from '../../../types';
import { IDexHelper } from '../../../dex-helper';
import { bigNumberify } from '../../../utils';
import { CurvePool } from './curve-pool';
import StableSwap3Pool from '../../../abi/curve-v1/StableSwap3Pool.json';

const pool = 'wbETH';
export const address: Address =
  '2'.toLowerCase();
const tokenAddress: Address = '0xbfab6fa95e0091ed66058ad493189d2cb29385e6';
const N_COINS: number = 2;
const PRECISION_MUL = ['1', '1'].map(bigNumberify);
const USE_LENDING = [false, false];
const COINS = [
  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  '0xa2e3356610840701bdf5611a53974510ae27e2e1',
];
const trackCoins = true;

export class WBETHpool extends CurvePool {
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
    prefix = 'wbETH',
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
