import { assert } from 'console';
import { IDexHelper } from '../../dex-helper';
import { Logger, MultiCallOutput } from '../../types';
import { getLogger } from '../log4js';
import { MultiCallParams, MultiResult } from '../multi-wrapper';
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

  // ALl registered instances from identifier to instance
  private _poolsToInstances: Record<string, IStatefulRpcPoller<any, any>> = {};

  // This pools will be updated if we see new block and the time has come
  private _poolsToBeUpdated: Set<string> = new Set();

  // This pools wont be updated before we change _isStateToBeUpdated to true
  private _idlePools: Set<string> = new Set();

  private constructor(protected dexHelper: IDexHelper) {
    this.logger = getLogger(
      `${this.constructor.name}-${dexHelper.config.data.network}`,
    );

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

  async onBlockNumber(blockNumber: number): Promise<void> {
    if (!this.isMaster) {
      return;
    }

    const poolsToBeUpdated: IStatefulRpcPoller<any, any>[] = [];

    Array.from(this._poolsToBeUpdated).forEach(p => {
      const pool = this._keyToPoolInstance(p);

      // We always expect pools in _poolsToBeUpdated to participate in updates
      assert(
        pool.isPoolParticipateInUpdates,
        `onBlockNumber: pool=${p} from ${pool.dexKey} is not participate in updates`,
      );

      if (
        !pool.isPoolInTheMiddleOfUpdate &&
        pool.isTimeToTriggerUpdate(blockNumber)
      ) {
        pool.isPoolInTheMiddleOfUpdate = true;
        poolsToBeUpdated.push(pool);
      }
    });

    if (poolsToBeUpdated.length === 0) {
      this.logger.debug(
        `onBlockNumber=${blockNumber} no pools to be updated. Skipping`,
      );
      return;
    }

    this._updatePoolStates(poolsToBeUpdated)
      .then(receivedBlockNumber => {
        // There is no guarantee that we receive latest state. This is our best effort
        if (receivedBlockNumber < blockNumber) {
          this.logger.warn(
            `onBlockNumber=${blockNumber} at least for some pools receivedBlockNumber=${receivedBlockNumber} is lower than expected`,
          );
        }
      })
      .catch(e =>
        this.logger.error(
          `onBlockNumber=${blockNumber} error while updating pools: ${e}`,
        ),
      )
      .finally(() => {
        poolsToBeUpdated.forEach(pool => {
          pool.isPoolInTheMiddleOfUpdate = false;
        });
      });
  }

  protected async _updatePoolStates(
    poolsToBeUpdated: IStatefulRpcPoller<any, any>[],
    blockNumber: number | 'latest' = 'latest',
    numberOfChunks?: number,
  ): Promise<number> {
    const indexDividers: number[] = [];

    const multiCalls = poolsToBeUpdated
      .map(p => p.getFetchStateWithBlockInfoMultiCalls())
      .flat();

    const results = (await this.dexHelper.multiWrapper.tryAggregate(
      false,
      multiCalls,
      blockNumber,
      numberOfChunks,
    )) as [MultiResult<number>, ...MultiResult<any>[]];

    let minBlockNumber = 0;
    const lastUpdatedAtMs = Date.now();

    await Promise.all(
      results.map(async (result, index) => {
        const pool = poolsToBeUpdated[index];
        try {
          const parsedStateResult =
            pool.parseStateFromMultiResultsWithBlockInfo(
              results,
              lastUpdatedAtMs,
            );

          await pool.setState(
            parsedStateResult.value,
            parsedStateResult.blockNumber,
            parsedStateResult.lastUpdatedAtMs,
          );
        } catch (e) {
          this.logger.error(
            `onBlockNumber=${blockNumber} error while parsing state from multicall for pool=${pool.identifierKey} from ${pool.dexKey}: ${e}`,
          );
        }
      }),
    );

    return minBlockNumber;
  }

  // When this method is called, we expect that all pools are initialized
  private _keyToPoolInstance(
    identifierKey: string,
  ): IStatefulRpcPoller<any, any> {
    const pool = this._poolsToInstances[identifierKey];
    assert(
      pool !== undefined,
      `keyToPoolInstance: pool=${identifierKey} is undefined`,
    );
    return pool;
  }

  initializePool<T, M>(statefulRpcPoller: IStatefulRpcPoller<T, M>) {
    const { identifierKey } = statefulRpcPoller;

    if (
      this._idlePools.has(identifierKey) ||
      this._poolsToBeUpdated.has(identifierKey) ||
      this._poolsToInstances.hasOwnProperty(identifierKey)
    ) {
      this.logger.warn(
        `Attempt to reinitialize existing poolIdentifier=` +
          `${identifierKey}. Maybe there is memory leak`,
      );
    } else {
      this._poolsToInstances[identifierKey] = statefulRpcPoller;
      statefulRpcPoller.isPoolParticipateInUpdates
        ? this._poolsToBeUpdated.add(identifierKey)
        : this._idlePools.add(identifierKey);
    }
  }
}
