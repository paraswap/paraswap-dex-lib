import { Address } from '../../../types';
import { ThreePool } from './3pool';
import StableSwapGUSD from '../../../abi/curve/StableSwapGUSD.json';
import { CurveMetapool } from './curve-metapool';
import { IDexHelper } from '../../../dex-helper';
import { bigNumberify } from '../../../utils';

const pool = 'gusd';
export const address: Address =
  '0x4f062658EaAF2C1ccf8C8e36D6824CDf41167956'.toLowerCase();
const tokenAddress: Address = '0xD2967f45c4f384DEEa880F807Be904762a3DeA07';
const N_COINS: number = 2;
const PRECISION_MUL = ['10000000000000000', '1'].map(bigNumberify);
const USE_LENDING = [false, false];
const COINS = [
  '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd',
  '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490',
];
const trackCoins = true;

export class GUSDPool extends CurveMetapool {
  constructor(
    parentName: string,
    dexHelper: IDexHelper,
    _pool = pool,
    _address = address,
    _tokenAddress = tokenAddress,
    _trackCoins = trackCoins,
    _abi: any = StableSwapGUSD,
    _N_COINS = N_COINS,
    _PRECISION_MUL = PRECISION_MUL,
    _USE_LENDING = USE_LENDING,
    _COINS = COINS,
    basepool = ThreePool,
  ) {
    super(
      parentName,
      dexHelper,
      dexHelper.getLogger('GUSDPool'),
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
