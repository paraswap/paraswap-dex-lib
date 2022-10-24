import _ from 'lodash';
import { ImplementationNames, PoolState } from '../../types';
import { get_D } from './get_D';
import { get_D_mem } from './get_D_mem';
import { _A } from './_A';
import { _xp_mem } from './_xp_mem';

interface DependantFuncs {
  _A: _A;
  get_D_mem: get_D_mem;
  _xp_mem: _xp_mem;
  get_D: get_D;
}

export type calc_token_amount = (
  state: PoolState,
  funcs: DependantFuncs,
  _amounts: bigint[],
  _is_deposit: boolean,
) => bigint;

const factoryPlain2CoinErc20 = (
  state: PoolState,
  funcs: DependantFuncs,
  _amounts: bigint[],
  _is_deposit: boolean,
): bigint => {
  const { N_COINS, rate_multipliers } = state.constants;

  const amp = funcs._A(state);
  const balances = state.balances;

  const D0 = funcs.get_D_mem(state, funcs, rate_multipliers, balances, amp);
  for (const i of _.range(Number(N_COINS))) {
    const amount = _amounts[i];
    if (_is_deposit) {
      balances[i] += amount;
    } else {
      balances[i] -= amount;
    }
  }
  const D1 = funcs.get_D_mem(state, funcs, rate_multipliers, balances, amp);
  let diff = 0n;
  if (_is_deposit) {
    diff = D1 - D0;
  } else {
    diff = D0 - D1;
  }
  return (diff * state.totalSupply) / D0;
};

const implementations: Record<ImplementationNames, calc_token_amount> = {
  [ImplementationNames.FACTORY_PLAIN_2COIN_ERC20]: factoryPlain2CoinErc20,
};

export default implementations;
