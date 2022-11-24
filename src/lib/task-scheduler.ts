import { Logger } from 'log4js';
import { AsyncOrSync } from 'ts-essentials';

export class TaskScheduler {
  private _timer?: NodeJS.Timeout;

  private preventNewTimer = false;

  constructor(
    private name: string,
    private logger: Logger,
    private task: () => AsyncOrSync<void>,
    private updatePeriodMs: number,
    private updateRetryPeriodMs: number,
    // If startImmediately is false, you should call manually setTimer() when
    // want scheduler to start
    startImmediately: boolean = false,
  ) {
    if (startImmediately) {
      this.executeTask();
    }
  }

  reinitializeTaskScheduler() {
    this.preventNewTimer = false;
  }

  private async executeTask() {
    if (this._timer) {
      // Just in case
      this.clearTimer();
    }

    try {
      await this.task();
      this.setTimer(this.updatePeriodMs);
    } catch (e: unknown) {
      this.logger.error(`${this.name} executeTask can not execute task: `, e);
      this.setTimer(this.updateRetryPeriodMs);
    }
  }

  clearTimer() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = undefined;
    }
  }

  setTimer(delay: number) {
    this.clearTimer();

    if (this.preventNewTimer) {
      return;
    }

    this._timer = setTimeout(this.executeTask.bind(this), delay);
  }

  releaseResources() {
    this.preventNewTimer = true;
    this.clearTimer();
  }
}
