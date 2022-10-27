import _ from 'lodash';
import { ImplementationNames, PoolState } from '../../types';

const NEED_TO_VERIFY = (
  state: PoolState,
  xp: bigint[],
  amp: bigint,
): bigint => {
  const { N_COINS } = state.constants;

  let S = 0n;
  for (const _x of xp) {
    S += _x;
  }
  if (S === 0n) {
    return 0n;
  }

  let Dprev = 0n;
  let D = S;
  const Ann = amp * N_COINS;
  for (const _i of _.range(255)) {
    let D_P = D;
    for (const _x of xp) {
      // If division by 0, this will be borked: only withdrawal will work. And that is good
      D_P = (D_P * D) / (_x * N_COINS);
    }
    Dprev = D;
    D =
      ((Ann * S + D_P * N_COINS) * D) / ((Ann - 1n) * D + (N_COINS + 1n) * D_P);
    // Equality with the precision of 1
    if (D > Dprev) {
      if (D - Dprev <= 1n) {
        break;
      }
    } else {
      if (Dprev - D <= 1n) {
        break;
      }
    }
  }
  return D;
};

const implementations: Record<ImplementationNames, get_D> = {
  [ImplementationNames.FACTORY_PLAIN_2COIN_ERC20]: NEED_TO_VERIFY,
};

export default implementations;
