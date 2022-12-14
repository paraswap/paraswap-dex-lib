import { Address } from '../../../types';
import { ThreePool } from './3pool';
import StableSwapDUSD from '../../../abi/curve-v1/StableSwapDUSD.json';
import { CurveMetapool } from './curve-metapool';
import { IDexHelper } from '../../../dex-helper';
import { bigNumberify } from '../../../utils';

const pool = 'dusd';
export const address: Address =
  '0x8038C01A0390a8c547446a0b2c18fc9aEFEcc10c'.toLowerCase();
const tokenAddress: Address = '0x3a664Ab939FD8482048609f652f9a0B0677337B9';
const N_COINS: number = 2;
const PRECISION_MUL = ['1', '1'].map(bigNumberify);
const USE_LENDING = [false, false];
const COINS = [
  '0x5bc25f649fc4e26069ddf4cf4010f9f706c23831',
  '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490',
];
const trackCoins = true;

export class DUSDPool extends CurveMetapool {
  constructor(
    parentName: string,
    dexHelper: IDexHelper,
    _pool = pool,
    _address = address,
    _tokenAddress = tokenAddress,
    _trackCoins = trackCoins,
    _abi: any = StableSwapDUSD,
    _N_COINS = N_COINS,
    _PRECISION_MUL = PRECISION_MUL,
    _USE_LENDING = USE_LENDING,
    _COINS = COINS,
    basepool = ThreePool,
  ) {
    super(
      parentName,
      dexHelper,
      dexHelper.getLogger('DUSDPool'),
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
