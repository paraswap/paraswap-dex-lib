import { Address } from '../../../types';
import { ThreePool } from './3pool';
import StableSwapEURS from '../../../abi/curve/StableSwapEURS.json';
import { IDexHelper } from '../../../dex-helper';
import { bigNumberify } from '../../../utils';

const pool = 'EURS';
export const address: Address =
  '0x0Ce6a5fF5217e38315f87032CF90686C96627CAA'.toLowerCase();
const tokenAddress: Address = '0x194eBd173F6cDacE046C53eACcE9B953F28411d1';
const N_COINS: number = 2;
const PRECISION_MUL = ['10000000000000000', '1'].map(bigNumberify);
const USE_LENDING = [false, false];
const COINS = [
  '0xdB25f211AB05b1c97D595516F45794528a807ad8',
  '0xD71eCFF9342A5Ced620049e616c5035F1dB98620',
];
const trackCoins = true;

export class EURSPool extends ThreePool {
  constructor(parentName: string, dexHelper: IDexHelper) {
    super(
      parentName,
      dexHelper,
      pool,
      address,
      tokenAddress,
      trackCoins,
      StableSwapEURS,
      N_COINS,
      PRECISION_MUL,
      USE_LENDING,
      COINS,
      'EURSPool',
    );
  }
}
