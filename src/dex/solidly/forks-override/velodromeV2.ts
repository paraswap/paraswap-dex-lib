import { Solidly } from '../solidly';
import { Network } from '../../../constants';
import { getDexKeysWithNetwork } from '../../../utils';
import { SolidlyConfig } from '../config';
import _ from 'lodash';

export class Velodrome extends Solidly {
  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(_.pick(SolidlyConfig, ['VelodromeV2']));
}
