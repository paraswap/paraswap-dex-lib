import { Logger } from 'log4js';
import { IDexHelper } from '../../dex-helper';
import { TaskScheduler } from '../../lib/task-scheduler';
import {
  STATE_UPDATE_FREQUENCY,
  STATE_UPDATE_RETRY_FREQUENCY,
} from './constants';
import { BasePoolPolling } from './state-polling-pools/base-pool-polling';
import { StatePollingManager } from './state-polling-pools/polling-manager';
import { PoolState } from './types';

export class CurveV1PoolManager {
  private statePollingPoolsFromId: Record<string, BasePoolPolling<PoolState>> =
    {};
  private statePollingManager = StatePollingManager;
  private taskScheduler: TaskScheduler;

  constructor(
    private name: string,
    private logger: Logger,
    private dexHelper: IDexHelper,
    stateUpdateFrequency: number = STATE_UPDATE_FREQUENCY,
    stateUpdateRetryFrequency: number = STATE_UPDATE_RETRY_FREQUENCY,
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
      Object.values(this.statePollingPoolsFromId),
    );
  }

  getState(poolIdentifiers: string[]): PoolState[] {
    return [];
  }

  releaseResources() {
    this.taskScheduler.releaseResources();
  }
}
