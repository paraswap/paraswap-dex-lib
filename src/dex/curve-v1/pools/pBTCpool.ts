import { Address } from '../../../types';
import { SBTCPool } from './sBTCpool';
import StableSwapPBTC from '../../../abi/curve/StableSwapPBTC.json';
import { CurveMetapool } from './curve-metapool';
import { IDexHelper } from '../../../dex-helper';
import { bigNumberify } from '../../../utils';

const pool = 'pbtc';
export const address: Address =
  '0x7F55DDe206dbAD629C080068923b36fe9D6bDBeF'.toLowerCase();
const tokenAddress: Address = '0xDE5331AC4B3630f94853Ff322B66407e0D6331E8';
const N_COINS: number = 2;
const PRECISION_MUL = ['1', '1'].map(bigNumberify);
const USE_LENDING = [false, false];
const COINS = [
  '0x5228a22e72ccC52d415EcFd199F99D0665E7733b',
  '0x075b1bb99792c9E1041bA13afEf80C91a1e70fB3',
];
const trackCoins = true;

export class PBTCPool extends CurveMetapool {
  constructor(
    parentName: string,
    dexHelper: IDexHelper,
    _pool = pool,
    _address = address,
    _tokenAddress = tokenAddress,
    _trackCoins = trackCoins,
    _abi: any = StableSwapPBTC,
    _N_COINS = N_COINS,
    _PRECISION_MUL = PRECISION_MUL,
    _USE_LENDING = USE_LENDING,
    _COINS = COINS,
    basepool = SBTCPool,
  ) {
    super(
      parentName,
      dexHelper,
      dexHelper.getLogger('PBTCPool'),
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
