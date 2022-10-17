import { PoolStateWithUpdateInfo } from '../types';

export interface IStateHandler<T> {
  getState(): PoolStateWithUpdateInfo<T> | null;

  generateState(
    blockNumber?: number,
  ): Promise<PoolStateWithUpdateInfo<T> | null>;
}
