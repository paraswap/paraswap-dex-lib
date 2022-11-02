import { Address } from '../../../types';
import { SBTCPool } from './sBTCpool';
import StableSwapOBTC from '../../../abi/curve-v1/StableSwapOBTC.json';
import { CurveMetapool } from './curve-metapool';
import { IDexHelper } from '../../../dex-helper';
import { bigNumberify } from '../../../utils';

const pool = 'obtc';
export const address: Address =
  '0xd81dA8D904b52208541Bade1bD6595D8a251F8dd'.toLowerCase();
const tokenAddress: Address = '0x2fE94ea3d5d4a175184081439753DE15AeF9d614';
const N_COINS: number = 2;
const PRECISION_MUL = ['1', '1'].map(bigNumberify);
const USE_LENDING = [false, false];
const COINS = [
  '0x8064d9Ae6cDf087b1bcd5BDf3531bD5d8C537a68',
  '0x075b1bb99792c9E1041bA13afEf80C91a1e70fB3',
];
const trackCoins = true;

export class OBTCPool extends CurveMetapool {
  constructor(
    parentName: string,
    dexHelper: IDexHelper,
    _pool = pool,
    _address = address,
    _tokenAddress = tokenAddress,
    _trackCoins = trackCoins,
    _abi: any = StableSwapOBTC,
    _N_COINS = N_COINS,
    _PRECISION_MUL = PRECISION_MUL,
    _USE_LENDING = USE_LENDING,
    _COINS = COINS,
    basepool = SBTCPool,
  ) {
    super(
      parentName,
      dexHelper,
      dexHelper.getLogger('OBTCPool'),
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
