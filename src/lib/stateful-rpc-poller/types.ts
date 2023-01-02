import { MultiCallParams } from '../multi-wrapper';

export type StateWithUpdateInfo<T> = {
  state: T;
  blockNumber: number;
  lastUpdatedAtMs: number;
};

export interface IStatefulRpcPoller<State, M> {
  poolIdentifier: string;

  isStateToBeUpdated: boolean;

  getFetchStateWithBlockInfoMultiCalls(): MultiCallParams<M>[];

  parseStateFromMultiResults(multiOutputs: M[]): State;

  _setState(
    state: State,
    blockNumber: number,
    lastUpdatedAtMs: number,
  ): Promise<void>;

  fetchStateFromCache(): Promise<StateWithUpdateInfo<State>>;

  getState(blockNumber: number): Promise<StateWithUpdateInfo<State> | null>;
}
