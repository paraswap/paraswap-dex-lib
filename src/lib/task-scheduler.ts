import { Logger } from 'log4js';
import { AsyncOrSync } from 'ts-essentials';
import { funcName } from '../utils';

export class TaskScheduler {
  private _timer?: NodeJS.Timeout;

  private preventNewTimer = false;

  constructor(
    private name: string,
    private logger: Logger,
    private task: () => AsyncOrSync<void>,
    private updateFrequency: number,
    private updateRetryFrequency: number,
    startImmediately: boolean = false,
  ) {
    if (startImmediately) {
      this.executeTask();
    }
  }

  private async executeTask() {
    if (this._timer) {
      // Just in case
      this.cleatTimer();
    }

    try {
      await this.task();
      this.setTimer(this.updateFrequency);
    } catch (e: unknown) {
      this.logger.error(`${this.name} ${funcName()} can not execute task: `, e);
      this.setTimer(this.updateRetryFrequency);
    }
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

    this._timer = setTimeout(this.executeTask.bind(this), delay);
  }

  releaseResources() {
    this.preventNewTimer = true;
    this.cleatTimer();
  }
}
