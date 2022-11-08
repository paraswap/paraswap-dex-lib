import { parallelLimit } from 'async';
import { Logger } from 'log4js';

export class PromiseScheduler {
  private promises: (() => Promise<boolean>)[] = [];

  constructor(
    private intervalMs: number,
    private parallelLimit: number,
    private logger: Logger,
  ) {
    this.run();
  }

  public addPromise(promiseFn: () => Promise<boolean>) {
    this.promises.push(promiseFn);
  }

  private async run() {
    this.logger.info(
      `start async parallel on ${this.promises.length} promises`,
    );
    if (this.promises.length === 0) {
      setTimeout(this.run.bind(this), this.intervalMs);
      return;
    }

    const promisesToExecute = this.promises;
    this.promises = [];

    let count = 0;

    const tasks = promisesToExecute.map(p => {
      return async () => {
        try {
          const res = await p();
          if (!res) {
            this.addPromise(p);
          }
        } catch (e) {
          this.logger.warn(`scheduled promise failed`, e);
          this.addPromise(p);
        }
        ++count;
        if (count == promisesToExecute.length) {
          this.logger.info(
            `async parallel done on ${this.promises.length} promises`,
          );
          setTimeout(this.run.bind(this), this.intervalMs);
        }
      };
    });
    parallelLimit(tasks, this.parallelLimit);
  }
}
