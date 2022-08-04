import { Address } from '../../../types';
import { ThreePool } from './3pool';
import StableSwapRSV from '../../../abi/curve/StableSwapRSV.json';
import { CurveMetapool } from './curve-metapool';
import { IDexHelper } from '../../../dex-helper';
import { bignumberify } from '../../../utils';

const pool = 'rsv';
export const address: Address =
  '0xC18cC39da8b11dA8c3541C598eE022258F9744da'.toLowerCase();
const tokenAddress: Address = '0xC2Ee6b0334C261ED60C72f6054450b61B8f18E35';
const N_COINS: number = 2;
const PRECISION_MUL = ['1', '1'].map(bignumberify);
const USE_LENDING = [false, false];
const COINS = [
  '0x196f4727526eA7FB1e17b2071B3d8eAA38486988',
  '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490',
];
const trackCoins = true;

export class RSVPool extends CurveMetapool {
  constructor(
    parentName: string,
    dexHelper: IDexHelper,
    _pool = pool,
    _address = address,
    _tokenAddress = tokenAddress,
    _trackCoins = trackCoins,
    _abi: any = StableSwapRSV,
    _N_COINS = N_COINS,
    _PRECISION_MUL = PRECISION_MUL,
    _USE_LENDING = USE_LENDING,
    _COINS = COINS,
    basepool = ThreePool,
  ) {
    super(
      parentName,
      dexHelper,
      dexHelper.getLogger('RSVPool'),
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
