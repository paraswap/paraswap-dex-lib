import { IDexHelper } from '../../dex-helper';
import _ from 'lodash';
import { QuickSwapConfig } from './config';
import { QuickSwapV3 } from './quickswap-v3';

const config = _.pick(QuickSwapConfig, ['SpiritSwapV3']).SpiritSwapV3;

export class SpiritSwapV3 extends QuickSwapV3 {
  static dexKeys = ['spiritswapv3'];

  // public static dexKeysWithNetwork
  constructor(dexHelper: IDexHelper) {
    super(
      dexHelper,
      'spiritswapv3',
      config[dexHelper.config.data.network].router,
    );
  }
}
