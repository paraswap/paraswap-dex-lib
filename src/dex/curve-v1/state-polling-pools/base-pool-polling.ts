import { Logger } from 'log4js';
import { MultiCallParams, MultiResult } from '../../../lib/multi-wrapper';
import { funcName } from '../../../utils';
import { MAX_ALLOWED_STATE_DELAY } from '../constants';
import { PoolConstants } from '../types';

export abstract class BasePoolPolling<State = unknown, MultiData = unknown> {
  private _poolState: State | null = null;

  private _stateLastUpdatedAt: number = 0;

  constructor(
    protected name: string,
    protected logger: Logger,
    protected poolConstants: PoolConstants,
  ) {}

  protected _setState(state: State, updateAt: number) {
    this._poolState = state;
    this._stateLastUpdatedAt = updateAt;
  }

  abstract setState(
    multiOutputs: MultiResult<MultiData>[],
    updatedAt: number,
  ): void;

  abstract getStateMultiCalldata(): MultiCallParams<MultiData>[];

  getState(): State | null {
    if (
      this._poolState &&
      Date.now() - this._stateLastUpdatedAt < MAX_ALLOWED_STATE_DELAY
    ) {
      return this._poolState;
    } else if (this._poolState) {
      this.logger.error(
        `${this.name} ${funcName()}: state is older than max allowed time`,
      );
    } else {
      this.logger.error(
        `${this.name} ${funcName()}: state was not initialized properly`,
      );
    }

    return null;
  }
}
