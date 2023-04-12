import { Vault } from './vault';
import { Address } from '../../types';
import { DeepReadonly } from 'ts-essentials';

export class VaultUtils<State> {
  constructor(protected vault: Vault<State>) {}

  getFeeBasisPoints(
    state: DeepReadonly<State>,
    _token: Address,
    _usdmDelta: bigint,
    _feeBasisPoints: bigint,
    _taxBasisPoints: bigint,
    _increment: boolean,
  ) {
    if (!this.vault.hasDynamicFees) {
      return _feeBasisPoints;
    }

    const initialAmount = this.vault.getUSDMAmount(state, _token);
    let nextAmount = initialAmount + _usdmDelta;
    if (!_increment) {
      nextAmount = _usdmDelta > initialAmount ? 0n : initialAmount - _usdmDelta;
    }

    const targetAmount = this.vault.getTargetUsdmAmount(state, _token);
    if (targetAmount == 0n) {
      return _feeBasisPoints;
    }

    const initialDiff =
      initialAmount > targetAmount
        ? initialAmount - targetAmount
        : targetAmount - initialAmount;
    const nextDiff =
      nextAmount > targetAmount
        ? nextAmount - targetAmount
        : targetAmount - nextAmount;

    // action improves relative asset balance
    if (nextDiff < initialDiff) {
      const rebateBps = (_taxBasisPoints * initialDiff) / targetAmount;
      return rebateBps > _feeBasisPoints ? 0n : _feeBasisPoints - rebateBps;
    }

    let averageDiff = (initialDiff + nextDiff) / 2n;
    if (averageDiff > targetAmount) {
      averageDiff = targetAmount;
    }
    const taxBps = (_taxBasisPoints * averageDiff) / targetAmount;
    return _feeBasisPoints + taxBps;
  }
}
