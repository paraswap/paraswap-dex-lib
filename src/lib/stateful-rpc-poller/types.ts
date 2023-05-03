import { MultiCallParams, MultiResult } from '../multi-wrapper';

export type ObjWithUpdateInfo<T> = {
  value: T;
  blockNumber: number;
  lastUpdatedAtMs: number;
};

export interface IStatefulRpcPoller<State, M> {
  identifierKey: string;
  dexKey: string;

  // For example, if particular pool has enough liquidity, or maybe it is paused?
  isPoolParticipateInUpdates: boolean;

  isPoolInTheMiddleOfUpdate: boolean;

  network: number;

  isTimeToTriggerUpdate(blockNumber: number): boolean;

  getFetchStateWithBlockInfoMultiCalls(): [
    MultiCallParams<number>,
    ...MultiCallParams<M>[],
  ];

  parseStateFromMultiResultsWithBlockInfo(
    multiOutputs: [MultiResult<number>, ...MultiResult<M>[]],
    lastUpdatedAtMs: number,
  ): ObjWithUpdateInfo<State>;

  setState(
    state: State,
    blockNumber: number,
    lastUpdatedAtMs: number,
  ): Promise<void>;

  fetchStateFromCache(): Promise<ObjWithUpdateInfo<State> | null>;

  fetchLatestStateFromRpc(
    blockNumber: number | 'latest',
  ): Promise<ObjWithUpdateInfo<State> | null>;

  // This function must not throw any errors
  initializeState(): Promise<void>;

  getState(blockNumber: number): Promise<ObjWithUpdateInfo<State> | null>;

  setLiquidity(
    newLiquidityInUSD: number,
    lastUpdatedAtMs: number,
    blockNumber?: number,
  ): Promise<void>;
}

export type PollingManagerControllersCb = {
  enableStateTracking: (identifierKey: string) => void;
  disableStateTracking: (identifierKey: string) => void;
  registerPendingPool: <T, M>(
    statefulRpcPoller: IStatefulRpcPoller<T, M>,
  ) => void;
};

export enum StateSources {
  LOCAL_MEMORY = 'local_memory',
  CACHE = 'cache',
  RPC = 'rpc',
}
