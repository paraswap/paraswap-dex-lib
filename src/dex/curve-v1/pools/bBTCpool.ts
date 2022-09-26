import { Address } from '../../../types';
import { SBTCPool } from './sBTCpool';
import StableSwapBBTC from '../../../abi/curve/StableSwapBBTC.json';
import { CurveMetapool } from './curve-metapool';
import { IDexHelper } from '../../../dex-helper';
import { bigNumberify } from '../../../utils';

const pool = 'bbtc';
export const address: Address =
  '0x071c661B4DeefB59E2a3DdB20Db036821eeE8F4b'.toLowerCase();
const tokenAddress: Address = '0x410e3E86ef427e30B9235497143881f717d93c2A';
const N_COINS: number = 2;
const PRECISION_MUL = ['10000000000', '1'].map(bigNumberify);
const USE_LENDING = [false, false];
const COINS = [
  '0x9be89d2a4cd102d8fecc6bf9da793be995c22541',
  '0x075b1bb99792c9E1041bA13afEf80C91a1e70fB3',
];
const trackCoins = true;

export class BBTCPool extends CurveMetapool {
  constructor(
    parentName: string,
    dexHelper: IDexHelper,
    _pool = pool,
    _address = address,
    _tokenAddress = tokenAddress,
    _trackCoins = trackCoins,
    _abi: any = StableSwapBBTC,
    _N_COINS = N_COINS,
    _PRECISION_MUL = PRECISION_MUL,
    _USE_LENDING = USE_LENDING,
    _COINS = COINS,
    basepool = SBTCPool,
  ) {
    super(
      parentName,
      dexHelper,
      dexHelper.getLogger('BBTCPool'),
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
