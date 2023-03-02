import { IDexHelper } from '../../dex-helper';
import _ from 'lodash';
import { QuickSwapConfig } from './config';
import { QuickSwapV3 } from './quickswap-v3';

const config = _.pick(QuickSwapConfig, ['ZyberSwapV3']).ZyberSwapV3;

export class ZyberSwapV3 extends QuickSwapV3 {
  static dexKeys = ['zyberswapv3'];

  // public static dexKeysWithNetwork
  constructor(dexHelper: IDexHelper) {
    super(
      dexHelper,
      'zyberswapv3',
      config[dexHelper.config.data.network].router,
    );
  }
}
