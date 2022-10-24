import _ from 'lodash';
import { ImplementationNames, PoolState } from '../../types';

export type _xp_mem = (
  state: PoolState,
  _rates: bigint[],
  _balances: bigint[],
) => bigint[];

const factoryPlain2CoinErc20 = (
  state: PoolState,
  _rates: bigint[],
  _balances: bigint[],
): bigint[] => {
  const { N_COINS, PRECISION } = state.constants;

  const result = new Array(N_COINS).fill(0n);
  for (const i of _.range(Number(N_COINS))) {
    result[i] = (_rates[i] * _balances[i]) / PRECISION;
  }
  return result;
};

const implementations: Record<ImplementationNames, _xp_mem> = {
  [ImplementationNames.FACTORY_PLAIN_2COIN_ERC20]: factoryPlain2CoinErc20,
};

export default implementations;
