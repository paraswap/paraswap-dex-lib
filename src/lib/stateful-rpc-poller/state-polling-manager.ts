import { assert } from 'console';
import { IDexHelper } from '../../dex-helper';
import { Logger } from '../../types';
import { getLogger } from '../log4js';
import { TaskScheduler } from '../task-scheduler';
import { IStatefulRpcPoller } from './types';

export class StatePollingManager {
  private static __instances: Record<string, StatePollingManager> = {};

  static getInstance(dexHelper: IDexHelper): StatePollingManager {
    const network = dexHelper.config.data.network;
    if (StatePollingManager.__instances[network] === undefined) {
      StatePollingManager.__instances[network] = new StatePollingManager(
        dexHelper,
      );
    }
    return StatePollingManager.__instances[network];
  }

  private logger: Logger;

  private _poolsToInstances: Record<string, IStatefulRpcPoller<any, any>> = {};

  private _poolsToBeUpdated: Set<string> = new Set();

  private _idlePools: Set<string> = new Set();

  private constructor(protected dexHelper: IDexHelper) {
    this.logger = getLogger(this.constructor.name);

    if (this.isMaster) {
    }
  }

  get isMaster() {
    return !this.dexHelper.config.isSlave;
  }

  enableStateTracking(identifierKey: string) {
    assert(
      this._poolsToInstances[identifierKey] !== undefined,
      `enableTracking: pool with identifierKey=${identifierKey} is not initialized`,
    );
    this._poolsToBeUpdated.add(identifierKey);
    this._idlePools.delete(identifierKey);
  }

  disableStateTracking(identifierKey: string) {
    assert(
      this._poolsToInstances[identifierKey] !== undefined,
      `disableStateTracking: pool with identifierKey=${identifierKey} is not initialized`,
    );
    this._poolsToBeUpdated.delete(identifierKey);
    this._idlePools.add(identifierKey);
  }

  async onBlockNumber(blockNumber: number): Promise<void> {}

  initializePool<T, M>(statefulRpcPoller: IStatefulRpcPoller<T, M>) {
    const { identifierKey } = statefulRpcPoller;

    if (
      this._idlePools.has(identifierKey) ||
      this._poolsToBeUpdated.has(identifierKey) ||
      this._idlePools.hasOwnProperty(identifierKey)
    ) {
      this.logger.warn(
        `Attempt to reinitialize existing poolIdentifier=` +
          `${identifierKey}. Maybe there is memory leak`,
      );
    } else {
      this._poolsToInstances[identifierKey] = statefulRpcPoller;
      statefulRpcPoller.isStateToBeUpdated
        ? this._poolsToBeUpdated.add(identifierKey)
        : this._idlePools.add(identifierKey);
    }
  }
}
