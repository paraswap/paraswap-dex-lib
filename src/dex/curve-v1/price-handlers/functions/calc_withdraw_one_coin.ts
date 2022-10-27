import { ImplementationNames, PoolState } from '../../types';
import { get_D } from './get_D';
import { get_y_D } from './get_y_D';
import { _A } from './_A';
import { _calc_withdraw_one_coin } from './_calc_withdraw_one_coin';
import { _xp_mem } from './_xp_mem';

const factoryPlain2CoinErc20: calc_withdraw_one_coin = (
  state: PoolState,
  funcs: DependantFuncs,
  _burn_amount: bigint,
  i: number,
): bigint => {
  return funcs._calc_withdraw_one_coin(state, funcs, _burn_amount, i)[0];
};

export const implementations: Record<
  ImplementationNames,
  calc_withdraw_one_coin
> = {
  [ImplementationNames.FACTORY_PLAIN_2COIN_ERC20]: factoryPlain2CoinErc20,
};

export default implementations;
