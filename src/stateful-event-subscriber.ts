import { AsyncOrSync, DeepReadonly } from 'ts-essentials';
import { Log, Logger } from './types';
import { BlockHeader } from 'web3-eth';
import { EventSubscriber } from './dex-helper/iblock-manager';

import { MAX_BLOCKS_HISTORY } from './constants';

export abstract class StatefulEventSubscriber<State>
  implements EventSubscriber
{
  //The current state and its block number
  //Derived classes should not set these directly, and instead use setState()
  protected state: DeepReadonly<State> | null = null;
  protected stateBlockNumber: number = 0;

  //Derived classes should use setState() to record a new entry
  protected stateHistory: { [blockNumber: number]: DeepReadonly<State> } = {};

  //Invalid flag - indicates that the currently stored state might not be valid
  protected invalid: boolean = false;

  isTracking: () => boolean = () => false;

  constructor(public readonly name: string, protected logger: Logger) {}

  getStateBlockNumber(): Readonly<number> {
    return this.stateBlockNumber;
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
    for (const bn in this.stateHistory) {
      if (+bn >= blockNumber) break;
      delete this.stateHistory[bn];
    }
    if (this.state && this.stateBlockNumber < blockNumber) {
      this.state = null;
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
      let stateBeforeLog: DeepReadonly<State> | undefined;
      for (const bn in this.stateHistory) {
        if (+bn >= blockNumber) break;
        stateBeforeLog = this.stateHistory[bn];
      }
      //Ignoring logs if there's no older state to play them onto
      if (stateBeforeLog) {
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
  }

  //Removes all states that are beyond the given block number and sets the
  //current state to the latest one that is left, if any, unless the invalid
  //flag is not set, in which case the most recent state can be kept.
  rollback(blockNumber: number): void {
    if (this.invalid) {
      for (const bn in this.stateHistory) {
        if (+bn > blockNumber) {
          delete this.stateHistory[bn];
        } else {
          this.state = this.stateHistory[bn];
          this.stateBlockNumber = +bn;
        }
      }
      if (this.state && this.stateBlockNumber > blockNumber) {
        this.state = null;
      }
    } else {
      //Keep the current state in this.state and in the history
      for (const bn in this.stateHistory) {
        if (+bn > blockNumber && +bn !== this.stateBlockNumber) {
          delete this.stateHistory[bn];
        }
      }
    }
  }

  invalidate(): void {
    this.invalid = true;
  }

  //May return a state that is more recent than the block number specified, or
  //will return null if a recent enough state cannot be found, in which case the
  //caller should derive a state using another method (at an exact block
  //number), possibly using generateState(), and set it on this object using
  //setState.  In case isTracking() returns true, it is assumed that the stored
  //state is current and so the minBlockNumber will be disregarded.
  getState(minBlockNumber: number): DeepReadonly<State> | null {
    if (!this.state || this.invalid) return null;
    if (this.isTracking() || this.stateBlockNumber >= minBlockNumber) {
      return this.state;
    }
    return null;
  }

  // Returs the last set state. The state might be invalid or not updated.
  getStaleState(): DeepReadonly<State> | null {
    return this.state;
  }

  //Saves the state into the stateHistory, and cleans up any old state that is
  //no longer needed.  If the blockNumber is greater than or equal to the
  //current state, then the current state will be updated and the invalid flag
  //can be reset.
  setState(state: DeepReadonly<State>, blockNumber: number): void {
    if (!blockNumber) {
      this.logger.error('setState() with blockNumber', blockNumber);
      return;
    }
    this.stateHistory[blockNumber] = state;
    if (!this.state || blockNumber >= this.stateBlockNumber) {
      this.state = state;
      this.stateBlockNumber = blockNumber;
      this.invalid = false;
    }
    const minBlockNumberToKeep = this.stateBlockNumber - MAX_BLOCKS_HISTORY;
    let lastBlockNumber: number | undefined;
    for (const bn in this.stateHistory) {
      if (+bn <= minBlockNumberToKeep) {
        if (lastBlockNumber) delete this.stateHistory[lastBlockNumber];
      }
      if (+bn >= minBlockNumberToKeep) break;
      lastBlockNumber = +bn;
    }
  }
}
