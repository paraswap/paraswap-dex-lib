import { Logger, LogLevels } from '../../types';
import { IDexHelper } from '../../dex-helper';
import { IStatefulRpcPoller, StateWithUpdateInfo } from './types';
import { MultiCallParams } from '../multi-wrapper';
import { CACHE_PREFIX } from '../../constants';
import { uint256DecodeToNumber } from '../decoders';
import { assert } from 'ts-essentials';
import { getLogger } from '../log4js';

enum AllMessages {
  FALLBACK_TO_RPC = 'Failed to retrieve updated state from cache. Falling back to RPC',
}

export abstract class StatefulRpcPoller<State, M>
  implements IStatefulRpcPoller<State, M>
{
  // The current state and its block number
  // Derived classes should not set these directly, and instead use setState()
  protected state?: State;
  protected stateBlockNumber: number = 0;
  protected stateLastUpdatedAtMs: number = 0;

  // This values is used to determine if current pool will participate in update or not
  // We don't want to keep track of state od pools without liquidity
  protected liquidityInUSD: number = 0;
  protected liquidityLastUpdatedAtMs: number = 0;

  readonly cacheStateMapKey: string;
  readonly cacheLiquidityMapKey: string;

  // Store here encoded calls for blockNumber, blockTimestamp etc.
  protected _cachedMultiCallData: MultiCallParams<M | number>[] = [];

  protected aggregatedLogMessages: Record<string, number> = {};

  protected logger: Logger;

  constructor(
    readonly dexKey: string,
    readonly entityName: string,
    readonly poolIdentifier: string,
    protected dexHelper: IDexHelper,

    protected liquidityThresholdForUpdate: number,
    protected liquidityUpdateAllowedDelayMs: number,
    protected isLiquidityTracked: boolean,

    // It is allowed block delay before refetching the state
    protected maxAllowedDelayedBlockRpcPolling: number = dexHelper.config.data
      .maxAllowedDelayedBlockRpcPolling,
  ) {
    this.cacheLiquidityMapKey =
      `${CACHE_PREFIX}_${this.network}_${this.dexKey}_liquidity_usd`.toLowerCase();
    this.cacheStateMapKey =
      `${CACHE_PREFIX}_${this.network}_${this.dexKey}_states`.toLowerCase();
    this.logger = getLogger(`${this.dexKey}-${this.entityName}`);

    assert(
      this.maxAllowedDelayedBlockRpcPolling <=
        dexHelper.config.data.maxAllowedDelayedBlockRpcPolling,
      `You can not exceed global maxAllowedDelayedBlockRpcPolling=${dexHelper.config.data.maxAllowedDelayedBlockRpcPolling}. Received ${this.maxAllowedDelayedBlockRpcPolling}`,
    );

    this._cachedMultiCallData.push({
      target: this.dexHelper.multiContract.options.address,
      callData: this.dexHelper.multiContract.methods
        .getBlockNumber()
        .encodeABI(),
      decodeFunction: uint256DecodeToNumber,
    });
  }

  get network() {
    return this.dexHelper.config.data.network;
  }

  get isMaster() {
    return !this.dexHelper.config.isSlave;
  }

  protected _isStateOutdated(
    checkForBlockNumber: number,
    stateValidBlockNumber: number,
    stateValidityBlockNumDelay: number,
  ): boolean {
    return (
      checkForBlockNumber - stateValidBlockNumber > stateValidityBlockNumDelay
    );
  }

  protected _isInMemoryStateOutdated(blockNumber: number): boolean {
    return this._isStateOutdated(
      blockNumber,
      this.stateBlockNumber,
      this.maxAllowedDelayedBlockRpcPolling,
    );
  }

  async getState(
    blockNumber: number,
  ): Promise<StateWithUpdateInfo<State> | null> {
    // Try to get with least effort from local memory
    const localState = this.state;
    if (localState !== undefined) {
      if (!this._isInMemoryStateOutdated(blockNumber)) {
        return {
          state: localState,
          blockNumber: this.stateBlockNumber,
          lastUpdatedAtMs: this.stateLastUpdatedAtMs,
        };
      } else {
        this.logMessage(
          `State is outdated. Valid for number ${
            this.stateBlockNumber
          }, but requested for ${blockNumber}. Diff ${
            blockNumber - this.stateBlockNumber
          } blocks`,
          'trace',
        );
      }
    } else {
      this.logMessage(`State is not initialized in memory`, 'error');
    }

    // If we failed to get from memory. Try to fetch state from cache
    try {
    } catch (e) {
      this.logMessage(
        `Unexpected error while fetching state from Cache`,
        'error',
        e,
      );
    }
    this.logMessage(AllMessages.FALLBACK_TO_RPC, 'warn');

    // As the last step. If we failed everything above, try to fetch from RPC
    try {
    } catch (e) {
      this.logMessage(
        `Unexpected error while fetching state from RPC`,
        'error',
        e,
      );
    }

    // If nothing works, then we can not do anything here and skip this pool
    return null;
  }

  protected logMessage(message: string, level: LogLevels, arg?: unknown) {
    this.logger[level](`${this.dexKey}-${this.entityName}: ${message}`, arg);
  }

  get isStateToBeUpdated(): boolean {
    if (
      this.isLiquidityTracked &&
      Date.now() - this.liquidityLastUpdatedAtMs >
        this.liquidityUpdateAllowedDelayMs
    ) {
      this.logMessage(
        `liquidity is outdated. Last updated at ${this.liquidityLastUpdatedAtMs}`,
        'error',
      );
    }

    return this.liquidityInUSD >= this.liquidityThresholdForUpdate;
  }

  abstract _getFetchStateMultiCalls(): MultiCallParams<M>[];

  getFetchStateWithBlockInfoMultiCalls(): MultiCallParams<M>[] {
    return [];
  }

  abstract parseStateFromMultiResults(multiOutputs: M[]): State;

  async fetchLatestStateFromRpc(): Promise<StateWithUpdateInfo<State>> {
    return {} as StateWithUpdateInfo<State>;
  }

  async _setState(
    state: State,
    blockNumber: number,
    lastUpdatedAtMs: number,
  ): Promise<void> {
    this.state = state;
    this.stateBlockNumber = blockNumber;
    this.stateLastUpdatedAtMs = lastUpdatedAtMs;

    // Master version must keep cache version up to date
    if (this.isMaster) {
    }
  }

  abstract fetchStateFromCache(): Promise<StateWithUpdateInfo<State>>;
}
