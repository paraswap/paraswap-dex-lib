import { Velodrome } from './velodrome';
import { Network } from '../../../constants';
import { getDexKeysWithNetwork } from '../../../utils';
import { SolidlyConfig } from '../config';
import _ from 'lodash';

export class Ramses extends Velodrome {
  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(_.pick(SolidlyConfig, ['Ramses']));
}