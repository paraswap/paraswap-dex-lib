import { STABLE_GAS_COST } from './stablePool';
import { Step } from './types';
import { WEIGHTED_GAS_COST } from './weightedPool';

// This is a worst case gas cost for full buffer>swap>buffer steps
// https://sepolia.etherscan.io/tx/0x8c2c5ec7fc2855ed2ffab3467ee434f4e374e0ecf791e8d2b93c8d74e3f5b1fe
const BOOSTED_GAS_COST = 283058;

export function getGasCost(steps: Step[]): number {
  if (steps.length > 1) {
    // TODO - Improve accuracy for different steps/length, need to setup profiling
    // steps.forEach(s => console.log(s.isBuffer, s.poolState.poolType));
    return BOOSTED_GAS_COST;
  } else {
    // TODO Add cost for buffer pool type although this is a very unlikely single step
    if (steps[0].poolState.poolType === 'STABLE') return STABLE_GAS_COST;

    return WEIGHTED_GAS_COST;
  }
  return 1;
}
