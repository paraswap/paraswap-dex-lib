import { IDexHelper } from '../../dex-helper';
import _ from 'lodash';
import { QuickSwapConfig } from './config';
import { QuickSwapV3 } from './quickswap-v3';

const config = _.pick(QuickSwapConfig, ['CamelotV3']).CamelotV3;

export class CamelotV3 extends QuickSwapV3 {
  static dexKeys = ['camelotv3'];

  // public static dexKeysWithNetwork
  constructor(dexHelper: IDexHelper) {
    super(dexHelper, 'camelotv3', config[dexHelper.config.data.network].router);
  }
}
