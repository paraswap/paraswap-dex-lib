import { Address, Log, BlockHeader } from '../types';
import { AsyncOrSync, DeepReadonly } from 'ts-essentials';

export interface EventSubscriber<LazyUpdate> {
  //Contains a descriptive name for this subscriber, to be shown in logs etc.
  readonly name: string;

  //This field is set by BlockManager when you call subscribeToLogs() on it.
  //If isTracking() returns false (which should be a temporary condition),
  //implementers must not present states older than the latest/requested block
  //number to any query.
  //If isTracking() returns true, it is assumed that all logs up to the latest
  //block have been processed, hence it is fine to return the last calculated
  //state.
  isTracking: () => boolean;

  //Indicates that all events up to the given block number will be skipped.
  //When this is called, all states with block number less than the given block
  //number must be discarded.
  //Returns true if the state was updated
  restart(blockNumber: number): boolean;

  //Called to roll forward the state from log events and clear the invalid flag
  //if it has been set.  It is assumed that the logs are presented in
  //chronological order.  If there are no logs in the array, just clear the
  //invalid flag.
  //N.B. multiple blocks worth of logs may be passed into the same call.
  //Returns true if the state was updated
  update(
    logs: Readonly<Log>[],
    blockHeaders: Readonly<{ [blockNumber: number]: Readonly<BlockHeader> }>,
  ): AsyncOrSync<boolean>;

  //Will be called on a chain reorganisation prior to updating with new logs.
  //All state corresponding to blocks after the given number must be discarded,
  //except for the most recent state, if the invalid flag isn't still set.
  //Returns true if the state was updated
  rollback(blockNumber: number): boolean;

  //This will be called to set an invalid flag, when the block manager cannot
  //guarantee that all previously derived states are valid.  When this flag is
  //set, it is not permitted to present any pre-existing state to any query.
  //This invalid flag can be cleared when a new state is derived without using
  //logs, or otherwise when update() is called.
  //Returns true if the invalidate was updated
  invalidate(): boolean;

  setLazyUpdate(
    update: DeepReadonly<LazyUpdate> | null,
    blockNumber: number,
  ): void;

  getLazyUpdate(): {
    blockNumber: number;
    update: DeepReadonly<LazyUpdate> | null;
  };
}

// Currently the subscriber info is specific to dex pools but this can
// be extended general subscriber
export type SubscriberInfo<T> = {
  dexKey: string;
  identifier: string;
  initParams: T;
  addressSubscribed: Address | Address[];
  afterBlockNumber: number;
};

export type SubscriberFetcher = (
  subscriberInfo: SubscriberInfo<any>,
) => EventSubscriber<any>;

export interface IBlockManager {
  attachGetSubscriber(getSubscriber: SubscriberFetcher): void;

  subscribeToLogs(
    subscriberInfo: SubscriberInfo<any>,
    isLazy: boolean,
  ): EventSubscriber<any>;

  isAlreadySubscribedToLogs<T>(subscriberInfo: SubscriberInfo<T>): boolean;

  lazyUpdate<T>(
    identifier: string,
    update: T | null,
    blockNumber: number,
  ): void;
}
