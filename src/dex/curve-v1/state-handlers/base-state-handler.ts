import { Logger } from 'log4js';
import { funcName } from '../../../utils';
import {
  MAX_ALLOWED_STATE_DELAY,
  STATE_UPDATE_FREQUENCY,
  STATE_UPDATE_RETRY_FREQUENCY,
} from '../constants';
import { PoolStateWithUpdateInfo } from '../types';
import { IStateHandler } from './istate-handler';

export abstract class BaseStateHandler<T> implements IStateHandler<T> {
  protected _timer?: NodeJS.Timeout;

  protected stateWithUpdateInfo?: PoolStateWithUpdateInfo<T>;

  protected preventNewTimer = false;

  constructor(
    private stateUpdateFrequency: number = STATE_UPDATE_FREQUENCY,
    private stateUpdateRetryFrequency: number = STATE_UPDATE_RETRY_FREQUENCY,
    protected logger: Logger,
  ) {}

  async updateState(): Promise<void> {
    if (this._timer) {
      // If updateState function called outside, we don't want to make repeated state updates
      // nor have more than one timer
      this.cleatTimer();
    }

    try {
      this.stateWithUpdateInfo = (await this.generateState()) || undefined;
    } catch (e) {
      this.logger.error(`${funcName()}: couldn't update state: `, e);
      this.setTimer(this.stateUpdateRetryFrequency);
      return;
    }

    this.setTimer(this.stateUpdateFrequency);
  }

  abstract generateState(
    blockNumber?: number,
  ): Promise<PoolStateWithUpdateInfo<T> | null>;

  getState(): PoolStateWithUpdateInfo<T> | null {
    if (
      this.stateWithUpdateInfo &&
      Date.now() - this.stateWithUpdateInfo.lastUpdatedAt <
        MAX_ALLOWED_STATE_DELAY
    ) {
      return this.stateWithUpdateInfo;
    } else if (this.stateWithUpdateInfo !== undefined) {
      this.logger.error(`${funcName()}: state is older than max allowed time`);
    } else {
      this.logger.error(`${funcName()}: state was not initialized properly`);
    }

    return null;
  }

  cleatTimer() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = undefined;
    }
  }

  setTimer(delay: number) {
    this.cleatTimer();

    if (this.preventNewTimer) {
      return;
    }

    this._timer = setTimeout(this.updateState.bind(this), delay);
  }

  releaseResources() {
    this.preventNewTimer = true;
    this.cleatTimer();
  }
}
