import { DeepReadonly } from 'ts-essentials';
import { MetapoolState, PoolState } from './types';

export const biginterify = (val: any) => BigInt(val);

export const stringify = (val: any) => val.toString();

export const ZERO = biginterify(0);

export const ONE = biginterify(1);

export class MathUtil {
  static within1(a: bigint, b: bigint) {
    return MathUtil.difference(a, b) <= ONE;
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
    initialA: biginterify(state.initialA),
    futureA: biginterify(state.futureA),
    initialATime: biginterify(state.initialATime),
    futureATime: biginterify(state.futureATime),
    swapFee: biginterify(state.swapFee),
    adminFee: biginterify(state.adminFee),
    defaultDepositFee:
      state.defaultDepositFee && biginterify(state.defaultDepositFee),
    defaultWithdrawFee:
      state.defaultWithdrawFee && biginterify(state.defaultWithdrawFee),
    lpToken_supply: biginterify(state.lpToken_supply),
    balances: state.balances.map(biginterify),
    tokenPrecisionMultipliers: state.tokenPrecisionMultipliers.map(biginterify),
    isValid: state.isValid,
  };
}

export function typeCastMetapoolState(
  state: DeepReadonly<MetapoolState>,
  basePool: DeepReadonly<PoolState>,
): MetapoolState {
  const generalState = typeCastPoolState(state);
  (<MetapoolState>generalState).basePool = typeCastPoolState(basePool);
  return generalState as MetapoolState;
}
