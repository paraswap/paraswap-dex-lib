import _ from 'lodash';
import { funcName } from '../../../../utils';
import { ImplementationNames, PoolState } from '../../types';
import { IPoolContext, _rates } from '../types';
import { requireConstant } from './utils';

const customPlain3CoinBTC: _rates = (
  self: IPoolContext,
  state: PoolState,
): bigint[] => {
  const { PRECISION_MUL, N_COINS } = self.constants;
  const USE_LENDING = requireConstant(
    self.constants.USE_LENDING,
    'USE_LENDING',
    funcName(),
    self.IMPLEMENTATION_NAME,
  );
  const LENDING_PRECISION = requireConstant(
    self.constants.LENDING_PRECISION,
    'LENDING_PRECISION',
    funcName(),
    self.IMPLEMENTATION_NAME,
  );
  const result = [...PRECISION_MUL];
  const use_lending = [...USE_LENDING];
  for (const i of _.range(N_COINS)) {
    let rate = LENDING_PRECISION; // Used with no lending
    if (use_lending[i]) rate = state.exchangeRateCurrent[i];
    result[i] *= rate;
  }
  return result;
};

const implementations: Record<ImplementationNames, _rates> = {
  [ImplementationNames.CUSTOM_PLAIN_3COIN_BTC]: customPlain3CoinBTC,
};

export default implementations;
