import { Velodrome } from './velodrome';
import { Network } from '../../../constants';
import { getDexKeysWithNetwork } from '../../../utils';
import { InfusionFinanceConfig } from '../config';
import _ from 'lodash';

export class SoliSnek extends Velodrome {
  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(_.pick(InfusionFinanceConfig, ['SoliSnek']));
}
