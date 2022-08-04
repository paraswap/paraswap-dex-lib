import { Address } from '../../../types';
import { ThreePool } from './3pool';
import StableSwapHUSD from '../../../abi/curve/StableSwapHUSD.json';
import { CurveMetapool } from './curve-metapool';
import { IDexHelper } from '../../../dex-helper';
import { bignumberify } from '../../../utils';

const pool = 'husd';
export const address: Address =
  '0x3eF6A01A0f81D6046290f3e2A8c5b843e738E604'.toLowerCase();
const tokenAddress: Address = '0x5B5CFE992AdAC0C9D48E05854B2d91C73a003858';
const N_COINS: number = 2;
const PRECISION_MUL = ['10000000000', '1'].map(bignumberify);
const USE_LENDING = [false, false];
const COINS = [
  '0xdf574c24545e5ffecb9a659c229253d4111d87e1',
  '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490',
];
const trackCoins = true;

export class HUSDPool extends CurveMetapool {
  constructor(
    parentName: string,
    dexHelper: IDexHelper,
    _pool = pool,
    _address = address,
    _tokenAddress = tokenAddress,
    _trackCoins = trackCoins,
    _abi: any = StableSwapHUSD,
    _N_COINS = N_COINS,
    _PRECISION_MUL = PRECISION_MUL,
    _USE_LENDING = USE_LENDING,
    _COINS = COINS,
    basepool = ThreePool,
  ) {
    super(
      parentName,
      dexHelper,
      dexHelper.getLogger('HUSDPool'),
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
