import { PoolState } from '../types';
import { BaseCurveEventPool } from './base-pool';

export class CurveEventLendingPool extends BaseCurveEventPool {
  async generateState(blockNumber: number): Promise<Readonly<PoolState>> {
    // TODO: complete me!
    return {};
  }
}
