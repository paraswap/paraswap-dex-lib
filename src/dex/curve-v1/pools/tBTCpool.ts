import { Address } from '../../../types';
import { SBTCPool } from './sBTCpool';
import StableSwapTBTC from '../../../abi/curve/StableSwapTBTC.json';
import { CurveMetapool } from './curve-metapool';
import { IDexHelper } from '../../../dex-helper';
import { bignumberify } from '../../../utils';

const pool = 'tbtc';
export const address: Address =
  '0xC25099792E9349C7DD09759744ea681C7de2cb66'.toLowerCase();
const tokenAddress: Address = '0x64eda51d3Ad40D56b9dFc5554E06F94e1Dd786Fd';
const N_COINS: number = 2;
const PRECISION_MUL = ['1', '1'].map(bignumberify);
const USE_LENDING = [false, false];
const COINS = [
  '0x8dAEBADE922dF735c38C80C7eBD708Af50815fAa',
  '0x075b1bb99792c9E1041bA13afEf80C91a1e70fB3',
];
const trackCoins = true;

export class TBTCPool extends CurveMetapool {
  constructor(
    parentName: string,
    dexHelper: IDexHelper,
    _pool = pool,
    _address = address,
    _tokenAddress = tokenAddress,
    _trackCoins = trackCoins,
    _abi: any = StableSwapTBTC,
    _N_COINS = N_COINS,
    _PRECISION_MUL = PRECISION_MUL,
    _USE_LENDING = USE_LENDING,
    _COINS = COINS,
    basepool = SBTCPool,
  ) {
    super(
      parentName,
      dexHelper,
      dexHelper.getLogger('TBTCPool'),
      _pool,
      _address,
      _tokenAddress,
      _trackCoins,
      _abi,
      _N_COINS,
      _PRECISION_MUL,
      _USE_LENDING,
      _COINS,
      basepool,
    );
  }
}
