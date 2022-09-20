import { Address } from '../../../types';
import { ThreePool } from './3pool';
import StableSwapUSDK from '../../../abi/curve/StableSwapUSDK.json';
import { CurveMetapool } from './curve-metapool';
import { IDexHelper } from '../../../dex-helper';
import { bignumberify } from '../../../utils';

const pool = 'usdk';
export const address: Address =
  '0x3E01dD8a5E1fb3481F0F589056b428Fc308AF0Fb'.toLowerCase();
const tokenAddress: Address = '0x97E2768e8E73511cA874545DC5Ff8067eB19B787';
const N_COINS: number = 2;
const PRECISION_MUL = ['1', '1'].map(bignumberify);
const USE_LENDING = [false, false];
const COINS = [
  '0x1c48f86ae57291f7686349f12601910bd8d470bb',
  '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490',
];
const trackCoins = true;

export class USDKPool extends CurveMetapool {
  constructor(
    parentName: string,
    dexHelper: IDexHelper,
    _pool = pool,
    _address = address,
    _tokenAddress = tokenAddress,
    _trackCoins = trackCoins,
    _abi: any = StableSwapUSDK,
    _N_COINS = N_COINS,
    _PRECISION_MUL = PRECISION_MUL,
    _USE_LENDING = USE_LENDING,
    _COINS = COINS,
    basepool = ThreePool,
  ) {
    super(
      parentName,
      dexHelper,
      dexHelper.getLogger('USDKPool'),
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
