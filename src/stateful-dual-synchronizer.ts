import { assert, AsyncOrSync, DeepReadonly } from 'ts-essentials';
import { Log, Logger } from './types';
import { BlockHeader } from 'web3-eth';
import { EventSubscriber } from './dex-helper/iblock-manager';

import { MAX_BLOCKS_HISTORY } from './constants';
import { IDexHelper } from './dex-helper';
import { Utils } from './utils';

export type InitializeStateOptions<State> = {
  state?: DeepReadonly<State>;
  initCallback?: (state: DeepReadonly<State>) => void;
  forceRegenerate?: boolean; // deprecated ?
};

type ObjectOrString<State> = DeepReadonly<State> | string;
type ObjectOrStringOrNull<State> = ObjectOrString<State> | null;

// TODO:  make sure that we can get either state object or string
export abstract class StatefulDualSynchronizer<State>
  implements EventSubscriber
{
  //The current state and its block number
  //Derived classes should not set these directly, and instead use setState()
  protected state: ObjectOrStringOrNull<State> = null;
  protected stateBlockNumber: number = 0;

  //Derived classes should use setState() to record a new entry
  protected stateHistory: {
    [blockNumber: number]: ObjectOrString<State>;
  } = {};

  //Invalid flag - indicates that the currently stored state might not be valid
  protected invalid: boolean = false;

  isTracking: () => boolean = () => false;
  public addressesSubscribed: string[] = [];

  // parentName and Name are imposed by the interface. Prefer dexKey and poolIdentifier
  public parentName: string;
  public name: string;
  public isInitialized = false;

  constructor(
    public dexKey: string,
    public poolIdentifier: string,
    protected dexHelper: IDexHelper,
    protected logger: Logger,
  ) {
    this.dexKey = dexKey.toLowerCase();
    this.poolIdentifier = poolIdentifier.toLowerCase();

    // parentName and Name are imposed by the interface. Prefer dexKey and poolIdentifier
    this.parentName = this.dexKey;
    this.name = this.poolIdentifier;

    if (!this.dexHelper.config.isSlave) {
      this.dexHelper.dexStatePublisher.registerPool(
        this.dexKey,
        this.poolIdentifier,
        this,
      );
    }
  }

  getStateBlockNumber(): Readonly<number> {
    return this.stateBlockNumber;
  }

  //Function which set the initial state and bounded it to blockNumber
  //There is multiple possible case:
  // 1. You provide a state in options object the function will initialize with the provided state
  //  with blockNumber and subscribe to logs.
  // 2. if you are a master instance of dex-lib and no state is provided in options object
  //  then the function generate a new state with blockNumber as height and set the state with
  //  the result.
  // 3. if you are a slave instance of dex-lib
  //  either:
  //    - If a state is found in the cache and the state is not null we set our state with the
  //      cache state and cache blockNumber. Subscribe to logs with the cache blockNumber
  //  or:
  //    - If no valid state found in cache, we generate a new state with blockNumber
  //      and se state with blockNumber. Subscribe to logs with blockNumber. The function
  //      will also publish a message to cache to tell one master version of dex-lib that this slave
  //      instance subscribed to a pool from dex this.parentName and name this.name.
  async initialize(
    blockNumber: number,
    options?: InitializeStateOptions<State>,
  ) {
    let masterBn: undefined | number = undefined;
    if (options && options.state) {
      this.setState(options.state, blockNumber);
    } else {
      if (this.dexHelper.config.isSlave) {
        let updatedState =
          await this.dexHelper.dexStateSubscriber.requestDEXPoolState(
            this.dexKey,
            this.poolIdentifier,
            blockNumber,
          );

        this.setState(updatedState, blockNumber);
      } else {
        // if you are not a slave instance always generate new state
        this.logger.info(
          `${this.dexKey}: ${this.poolIdentifier}: cache generating state`,
        );
        const state = await this.generateState(blockNumber);
        this.setState(state, blockNumber);
      }
    }

    // apply a callback on the state
    if (options && options.initCallback) {
      if (this.state) {
        assert(
          typeof this.state !== 'string',
          'LOGIC ERROR: state is serialised',
        );
        options.initCallback(this.state);
      }
    }

    if (this.dexHelper.config.isSlave) {
      this.dexHelper.dexStateSubscriber.subscribeToDEXPoolUpdates(
        this.dexKey,
        this.poolIdentifier,
        (state: string, blockNumber: number) => {
          this.setState(state, blockNumber);
        },
      );
    } else {
      this.dexHelper.blockManager.subscribeToLogs(
        this,
        this.addressesSubscribed,
        masterBn || blockNumber,
      );
    }

    this.isInitialized = true;
  }

  //Function which transforms the given state for the given log event.
  //If the provided log does not affect the state, return null.
  protected abstract processLog(
    state: DeepReadonly<State>,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): AsyncOrSync<DeepReadonly<State> | null>;

  //This function processes all logs for a single block (the block number is
  //contained in each of the logs).  It is not allowed to call this function
  //with an empty logs array.  The default implementation here will just call
  //processLog for each of the logs; it may be overridden, if block specific
  //handling or handling multiple logs at once is needed.  Null should be
  //returned if none of the provided logs affect the state.
  protected async processBlockLogs(
    state: DeepReadonly<State>,
    logs: Readonly<Log>[],
    blockHeader: Readonly<BlockHeader>,
  ): Promise<DeepReadonly<State> | null> {
    let nextState: DeepReadonly<State> | null = null;
    for (const log of logs) {
      const retState: DeepReadonly<State> | null = await this.processLog(
        nextState || state,
        log,
        blockHeader,
      );
      if (retState) nextState = retState;
    }
    return nextState;
  }

  //Function used to generate a state if one is not currently present, which
  //must be the state at exactly the given block number, unless one is not
  //provided, in which case one should be generated for latest block.  This
  //function should not use any previous states to derive a new state, it should
  //generate one from scratch.
  abstract generateState(
    blockNumber?: number | 'latest',
  ): AsyncOrSync<DeepReadonly<State>>;

  restart(blockNumber: number): void {
    for (const _bn of Object.keys(this.stateHistory)) {
      const bn = +_bn;
      if (bn >= blockNumber) break;
      delete this.stateHistory[bn];
    }
    if (this.state && this.stateBlockNumber < blockNumber) {
      this.logger.info(
        `StatefulDualSynchronizer restart, bn: ${blockNumber}, state_bn: ${this.stateBlockNumber}: ${this.dexKey}: ${this.poolIdentifier}`,
      );
      this._setState(null, blockNumber);
    }
  }

  //Implementation must call setState() for every block in which the state
  //changes and must ignore any logs that aren't newer than the oldest state
  //stored.  If state is not set or null, then the implementation should derive
  //the state by another method for the block number of the first log, ignore
  //all logs with that block number and then proceed as normal for the remaining
  //logs.  Remember to clear the invalid flag, even if there are no logs!
  //A default implementation is provided here, but could be overridden.
  async update(
    logs: Readonly<Log>[],
    blockHeaders: Readonly<{ [blockNumber: number]: Readonly<BlockHeader> }>,
  ): Promise<void> {
    if (this.dexHelper.config.isSlave) {
      throw new Error(
        'LOGIC ERROR: we should expect to listen to events on slave instances',
      );
    }

    let index = 0;
    let lastBlockNumber: number | undefined;
    while (index < logs.length) {
      const blockNumber = logs[index].blockNumber;
      if (index && blockNumber <= lastBlockNumber!) {
        this.logger.error('update() received blocks out of order!');
      }
      const blockHeader = blockHeaders[blockNumber];
      if (!blockHeader) {
        this.logger.error('update() missing block header!');
      }
      let lastLogIndex = logs[index].logIndex;
      let indexBlockEnd = index + 1;
      while (
        indexBlockEnd < logs.length &&
        logs[indexBlockEnd].blockNumber === blockNumber
      ) {
        if (logs[indexBlockEnd].logIndex <= lastLogIndex) {
          this.logger.error('update() received logs out of order!');
        }
        lastLogIndex = logs[indexBlockEnd].logIndex;
        ++indexBlockEnd;
      }
      if (!this.state) {
        const freshState = await this.generateState(blockNumber);
        this.setState(freshState, blockNumber);
      }
      //Find the last state before the blockNumber of the logs
      let stateBeforeLog: DeepReadonly<State> | string | undefined;
      for (const _bn of Object.keys(this.stateHistory)) {
        const bn = +_bn;
        if (bn >= blockNumber) break;
        stateBeforeLog = this.stateHistory[bn];
      }
      //Ignoring logs if there's no older state to play them onto
      if (stateBeforeLog) {
        assert(
          typeof stateBeforeLog !== 'string',
          'LOGIC ERROR: state is serialised',
        );
        const nextState = await this.processBlockLogs(
          stateBeforeLog,
          logs.slice(index, indexBlockEnd),
          blockHeader,
        );
        if (nextState) this.setState(nextState, blockNumber);
      }
      lastBlockNumber = blockNumber;
      index = indexBlockEnd;
    }
    this.invalid = false;

    if (!this.dexHelper.config.isSlave && this.state === null) {
      const network = this.dexHelper.config.data.network;
      const createNewState = async () => {
        if (this.state !== null) {
          return true;
        }
        const latestBlockNumber =
          this.dexHelper.blockManager.getLatestBlockNumber();
        this.logger.warn(
          `${network}: ${this.dexKey}: ${this.poolIdentifier}: master generate (latest: ${latestBlockNumber}) new state because state is null`,
        );
        try {
          const state = await this.generateState(latestBlockNumber);
          this.setState(state, latestBlockNumber);
          return true;
        } catch (e) {
          this.logger.error(
            `${network}: ${this.dexKey} ${this.poolIdentifier}: (${latestBlockNumber}) failed fetch state:`,
            e,
          );
        }
        return false;
      };
      this.dexHelper.promiseScheduler.addPromise(createNewState);
    }
  }

  //Removes all states that are beyond the given block number and sets the
  //current state to the latest one that is left, if any, unless the invalid
  //flag is not set, in which case the most recent state can be kept.
  rollback(blockNumber: number): void {
    if (this.invalid) {
      let lastBn = undefined;
      //loop in the ascending order of the blockNumber. V8 property when object keys are number.
      for (const bn of Object.keys(this.stateHistory)) {
        const bnAsNumber = +bn;
        if (bnAsNumber > blockNumber) {
          delete this.stateHistory[+bn];
        } else {
          lastBn = bnAsNumber;
        }
      }

      if (lastBn) {
        this._setState(this.stateHistory[lastBn], lastBn);
      } else {
        this.logger.info(
          `StatefulDualSynchronizer rollback, bn: ${blockNumber}: ${this.dexKey}: ${this.poolIdentifier}`,
        );
        this._setState(null, blockNumber);
        // TODO: explore generating new state on invalidation
      }
    } else {
      //Keep the current state in this.state and in the history
      for (const _bn of Object.keys(this.stateHistory)) {
        const bn = +_bn;
        if (+bn > blockNumber && +bn !== this.stateBlockNumber) {
          delete this.stateHistory[bn];
        }
      }
    }
  }

  invalidate(): void {
    this.logger.info(
      `StatefulDualSynchronizer invalidate: ${this.dexKey}: ${this.poolIdentifier}`,
    );
    this.invalid = true;

    // TODO: explore generating new state on invalidation
  }

  //May return a state that is more recent than the block number specified, or
  //will return null if a recent enough state cannot be found, in which case the
  //caller should derive a state using another method (at an exact block
  //number), possibly using generateState(), and set it on this object using
  //setState.  In case isTracking() returns true, it is assumed that the stored
  //state is current and so the minBlockNumber will be disregarded.
  getState(minBlockNumber: number): DeepReadonly<State> | null {
    if (!this.state || this.invalid) return null;

    if (this.dexHelper.config.isSlave) {
      if (
        this.dexHelper.dexStateSubscriber.isSynced(minBlockNumber) ||
        this.stateBlockNumber >= minBlockNumber
      ) {
        if (typeof this.state === 'string') {
          this.state = Utils.Parse(this.state);
        }
        assert(
          typeof this.state !== 'string',
          'LOGIC ERROR: state is serialised',
        );
        return this.state;
      }
    } else {
      if (this.isTracking() || this.stateBlockNumber >= minBlockNumber) {
        if (typeof this.state === 'string') {
          this.state = Utils.Parse(this.state);
        }
        assert(
          typeof this.state !== 'string',
          'LOGIC ERROR: state is serialised',
        );
        return this.state;
      }
    }

    return null; // DEX need to implement an fallback strategy here
  }

  // Returns the last set state. The state might be invalid or not updated.
  getStaleState(): DeepReadonly<State> | null {
    if (typeof this.state === 'string') {
      this.state = Utils.Parse(this.state);
    }
    assert(typeof this.state !== 'string', 'LOGIC ERROR: state is serialised');
    return this.state;
  }

  _setState(state: ObjectOrStringOrNull<State>, blockNumber: number) {
    this.state = state;
    this.stateBlockNumber = blockNumber;
  }

  //Saves the state into the stateHistory, and cleans up any old state that is
  //no longer needed.  If the blockNumber is greater than or equal to the
  //current state, then the current state will be updated and the invalid flag
  //can be reset.
  setState(state: ObjectOrString<State>, blockNumber: number): void {
    if (!blockNumber) {
      this.logger.error('setState() with blockNumber', blockNumber);
      return;
    }
    this.stateHistory[blockNumber] = state;
    if (!this.state || blockNumber >= this.stateBlockNumber) {
      this._setState(state, blockNumber);
      this.invalid = false;
    }
    const minBlockNumberToKeep = this.stateBlockNumber - MAX_BLOCKS_HISTORY;
    let lastBlockNumber: number | undefined;
    for (const bn of Object.keys(this.stateHistory)) {
      if (+bn <= minBlockNumberToKeep) {
        if (lastBlockNumber) delete this.stateHistory[lastBlockNumber];
      }
      if (+bn >= minBlockNumberToKeep) break;
      lastBlockNumber = +bn;
    }
  }
}
