import { IDexHelper } from '../../dex-helper';
import _ from 'lodash';
//import { QuickSwapConfig } from './config';
import { QuickSwapV3 } from './quickswap-v3';

//const config = _.pick(QuickSwapConfig, ['CamelotV3']).CamelotV3;

export class CamelotV3 extends QuickSwapV3 {
  static dexKeys = ['camelotv3'];

  // public static dexKeysWithNetwork
  constructor(dexHelper: IDexHelper) {
    super(dexHelper, 'camelotv3', '0x1F721E2E82F6676FCE4eA07A5958cF098D339e18');
  }
}
