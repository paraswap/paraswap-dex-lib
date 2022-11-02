import { Address } from '../../../types';
import { ThreePool } from './3pool';
import StableSwapUST from '../../../abi/curve-v1/StableSwapUST.json';
import { CurveMetapool } from './curve-metapool';
import { IDexHelper } from '../../../dex-helper';
import { bigNumberify } from '../../../utils';

const pool = 'ust';
export const address: Address =
  '0x890f4e345B1dAED0367A877a1612f86A1f86985f'.toLowerCase();
const tokenAddress: Address = '0x94e131324b6054c0D789b190b2dAC504e4361b53';
const N_COINS: number = 2;
const PRECISION_MUL = ['1', '1'].map(bigNumberify);
const USE_LENDING = [false, false];
const COINS = [
  '0xa47c8bf37f92aBed4A126BDA807A7b7498661acD',
  '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490',
];
const trackCoins = true;

export class USTPool extends CurveMetapool {
  constructor(
    parentName: string,
    dexHelper: IDexHelper,
    _pool = pool,
    _address = address,
    _tokenAddress = tokenAddress,
    _trackCoins = trackCoins,
    _abi: any = StableSwapUST,
    _N_COINS = N_COINS,
    _PRECISION_MUL = PRECISION_MUL,
    _USE_LENDING = USE_LENDING,
    _COINS = COINS,
    basepool = ThreePool,
  ) {
    super(
      parentName,
      dexHelper,
      dexHelper.getLogger('USTPool'),
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
