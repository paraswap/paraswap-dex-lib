import { Network } from '../../../constants';
import { getDexKeysWithNetwork } from '../../../utils';
import { SolidlyConfig } from '../config';
import _ from 'lodash';
import { Chronos } from './chronos';
import { SolidlyPair } from '../types';
import { Interface } from '@ethersproject/abi';

export class Ramses extends Chronos {
  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(_.pick(SolidlyConfig, ['Ramses']));
}
