import { Logger } from 'log4js';
import { Address } from 'paraswap-core';
import { IDexHelper } from '../../dex-helper';
import { TaskScheduler } from '../../lib/task-scheduler';
import {
  STATE_UPDATE_FREQUENCY_MS,
  STATE_UPDATE_RETRY_FREQUENCY_MS,
} from './constants';
import { BasePoolPolling } from './state-polling-pools/base-pool-polling';
import { StatePollingManager } from './state-polling-pools/polling-manager';
import { PoolState } from './types';

export class CurveV1FactoryPoolManager {
  // This is needed because we initialize all factory pools + 3 custom pools
  // That 3 custom pools are not fully supported. I need them only in meta pools
  // to get poolState, but not for pricing requests.
  // It appears from CurveV1 and CurveV1Factory duality
  private poolsForOnlyState: Record<string, BasePoolPolling> = {};

  private statePollingPoolsFromId: Record<string, BasePoolPolling> = {};

  private statePollingManager = StatePollingManager;
  private taskScheduler: TaskScheduler;

  constructor(
    private name: string,
    private logger: Logger,
    private dexHelper: IDexHelper,
    stateUpdateFrequency: number = STATE_UPDATE_FREQUENCY_MS,
    stateUpdateRetryFrequency: number = STATE_UPDATE_RETRY_FREQUENCY_MS,
  ) {
    this.taskScheduler = new TaskScheduler(
      this.name,
      this.logger,
      this.updatePollingPoolsInBatch.bind(this),
      stateUpdateFrequency,
      stateUpdateRetryFrequency,
    );
  }

  initializePollingPools() {
    // Execute and start timer
    this.taskScheduler.setTimer(0);
  }

  updatePollingPoolsInBatch() {
    this.statePollingManager.updatePoolsInBatch(
      this.dexHelper.multiWrapper,
      Object.values(this.statePollingPoolsFromId).concat(
        Object.values(this.poolsForOnlyState),
      ),
    );
  }

  getState(poolIdentifiers: string[]): PoolState[] {
    return [];
  }

  releaseResources() {
    this.taskScheduler.releaseResources();
  }

  initializeNewPool(identifier: string, pool: BasePoolPolling) {
    this.statePollingPoolsFromId[identifier.toLowerCase()] = pool;
  }

  initializeNewPoolForState(identifier: string, pool: BasePoolPolling) {
    this.poolsForOnlyState[identifier.toLowerCase()] = pool;
  }

  getPool(identifier: string): BasePoolPolling | null {
    const fromPools = this.statePollingPoolsFromId[identifier.toLowerCase()];
    if (fromPools !== undefined) {
      return fromPools;
    }
    const fromStateOnlyPools = this.poolsForOnlyState[identifier.toLowerCase()];
    if (fromStateOnlyPools !== undefined) {
      return fromStateOnlyPools;
    }
    return null;
  }
}
