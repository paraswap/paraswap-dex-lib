import _ from 'lodash';
import { ImplementationNames, PoolState } from '../../types';
import { get_D } from './get_D';
import { _xp_mem } from './_xp_mem';

const factoryPlain2CoinErc20 = (
  state: PoolState,
  funcs: DependantFuncs,
  _rates: bigint[],
  _balances: bigint[],
  _amp: bigint,
): bigint => {
  const xp = funcs._xp_mem(state, _rates, _balances);
  return funcs.get_D(state, xp, _amp);
};

export enum variations {
  DEFAULT = 'default',
}

export const implementations: Record<ImplementationNames, get_D_mem> = {
  [ImplementationNames.FACTORY_PLAIN_2COIN_ERC20]: factoryPlain2CoinErc20,
};

export default implementations;
