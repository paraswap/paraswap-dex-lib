import { DeepReadonly } from 'ts-essentials';
import { bigIntify } from '../../utils';
import { PoolState } from './types';

export class MathUtil {
  static within1(a: bigint, b: bigint) {
    return MathUtil.difference(a, b) <= 1n;
  }

  static difference(a: bigint, b: bigint) {
    if (a > b) {
      return a - b;
    }
    return b - a;
  }
}

export function typeCastPoolState(state: DeepReadonly<PoolState>): PoolState {
  return {
    initialA: bigIntify(state.initialA),
    futureA: bigIntify(state.futureA),
    initialATime: bigIntify(state.initialATime),
    futureATime: bigIntify(state.futureATime),
    swapFee: bigIntify(state.swapFee),
    adminFee: bigIntify(state.adminFee),
    defaultDepositFee:
      state.defaultDepositFee && bigIntify(state.defaultDepositFee),
    defaultWithdrawFee:
      state.defaultWithdrawFee && bigIntify(state.defaultWithdrawFee),
    lpToken_supply: bigIntify(state.lpToken_supply),
    balances: state.balances.map(bigIntify),
    tokenPrecisionMultipliers: state.tokenPrecisionMultipliers.map(bigIntify),
    isValid: state.isValid,
  };
}
