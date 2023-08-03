import { Network } from '../../../constants';
import { getDexKeysWithNetwork } from '../../../utils';
import { SolidlyConfig } from '../config';
import _ from 'lodash';
import { Chronos, ChronosSubgraphPool } from './chronos';
import { PoolLiquidity } from '../../../types';
import BigNumber from 'bignumber.js';

export type RamsesSubgraphPool = {
  id: string;
  isStable: boolean;
  token0: string;
  reserve0: string;
  reserve1: string;
  token1: string;
};

export class Ramses extends Chronos {
  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(_.pick(SolidlyConfig, ['Ramses']));
}
