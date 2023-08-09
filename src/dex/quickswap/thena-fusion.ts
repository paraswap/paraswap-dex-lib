import { IDexHelper } from '../../dex-helper';
import _ from 'lodash';
import { QuickSwapConfig } from './config';
import { QuickSwapV3 } from './quickswap-v3';

const config = _.pick(QuickSwapConfig, ['ThenaFusion']).ThenaFusion;

export class ThenaFusion extends QuickSwapV3 {
  static dexKeys = ['thenafusion'];

  // public static dexKeysWithNetwork
  constructor(dexHelper: IDexHelper) {
    super(
      dexHelper,
      'thenafusion',
      config[dexHelper.config.data.network].router,
    );
  }
}
