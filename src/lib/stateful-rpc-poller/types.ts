import { MultiCallParams } from '../multi-wrapper';

export type ObjWithUpdateInfo<T> = {
  value: T;
  blockNumber: number;
  lastUpdatedAtMs: number;
};

export interface IStatefulRpcPoller<State, M> {
  poolIdentifier: string;

  isStateToBeUpdated: boolean;

  getFetchStateWithBlockInfoMultiCalls(): [
    MultiCallParams<number>,
    ...MultiCallParams<M>[],
  ];

  parseStateFromMultiResultsWithBlockInfo(
    multiOutputs: [number, ...M[]],
    lastUpdatedAtMs: number,
  ): ObjWithUpdateInfo<State>;

  setState(
    state: State,
    blockNumber: number,
    lastUpdatedAtMs: number,
  ): Promise<void>;

  fetchStateFromCache(): Promise<ObjWithUpdateInfo<State> | null>;

  getState(blockNumber: number): Promise<ObjWithUpdateInfo<State> | null>;

  setLiquidity(
    newLiquidityInUSD: number,
    lastUpdatedAtMs: number,
    blockNumber?: number,
  ): Promise<void>;
}
