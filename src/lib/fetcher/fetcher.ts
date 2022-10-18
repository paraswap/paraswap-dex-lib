import { IRequestWrapper } from '../../dex-helper';
import { Logger } from 'log4js';
import { RequestConfig, Response } from '../../dex-helper/irequest-wrapper';

import Timeout = NodeJS.Timeout;

const FETCH_TIMEOUT_MS = 10 * 1000;
const FETCH_FAIL_MAX_ATTEMPT = 5;
const FETCH_FAIL_RETRY_TIMEOUT_MS = 60 * 1000;

export type RequestInfo<T> = {
  requestOptions: RequestConfig;
  caster: (data: unknown) => T | null;
  authenticate?: (options: RequestConfig) => void;
  excludedFieldsCaching?: string[];
};

export type RequestInfoWithHandler<T> = {
  info: RequestInfo<T>;
  handler: (data: T) => void;
};

export default class Fetcher<T> {
  private intervalId?: Timeout;
  private requests: RequestInfoWithHandler<T>[];
  public lastFetchSucceded: boolean = false;
  private failedCount = 0;

  constructor(
    private requestWrapper: IRequestWrapper,
    requestsInfo: RequestInfoWithHandler<T> | RequestInfoWithHandler<T>[],
    private pollInterval: number,
    private logger: Logger,
  ) {
    if (Array.isArray(requestsInfo)) {
      this.requests = requestsInfo;
    } else {
      this.requests = [requestsInfo];
    }
  }

  async fetch() {
    if (this.failedCount >= FETCH_FAIL_MAX_ATTEMPT) {
      this.stopPolling();

      setTimeout(() => {
        this.startPolling();
        this.failedCount = 0;
      }, FETCH_FAIL_RETRY_TIMEOUT_MS);
      return;
    }

    const promises = this.requests.map<Promise<Error | Response<T>>>(
      async (reqInfo: RequestInfoWithHandler<T>) => {
        const info = reqInfo.info;
        let options = info.requestOptions;
        if (info.authenticate) {
          info.authenticate(options);
        }

        try {
          const result = await this.requestWrapper.request({
            timeout: FETCH_TIMEOUT_MS,
            ...options,
          });
          return result;
        } catch (e) {
          return e as Error;
        }
      },
    );
    const results = await Promise.all(promises);
    const failures = results
      .map((_, i) => i)
      .filter(i => results[i] instanceof Error);

    failures.forEach(i => {
      this.logger.warn(
        `failled polling ${this.requests[i].info.requestOptions.url} ${results[i]}`,
      );
    });

    if (failures.length === results.length) {
      this.lastFetchSucceded = false;
      this.failedCount += 1;
    } else {
      this.lastFetchSucceded = true;
    }

    results
      .map((_, i) => i)
      .filter(i => !(results[i] instanceof Error))
      .forEach(i => {
        const response = results[i] as Response<T>;
        const reqInfo = this.requests[i];
        const info = reqInfo.info;
        const options = reqInfo.info.requestOptions;

        const parsedData = info.caster(response.data);

        if (!parsedData) {
          this.logger.debug(`(${options.url}) received incorrect data`);
          return;
        }

        reqInfo.handler(parsedData);
        this.logger.debug(`(${options.url}) received new data`);
      });
  }

  private getUrls(): string[] {
    return this.requests.map(el => el.info.requestOptions.url!);
  }

  startPolling(): void {
    if (this.intervalId) return;

    this.intervalId = setInterval(() => {
      this.fetch();
    }, this.pollInterval);
    // TODO add some mechanism for removing polling if it's failing

    this.logger.info(`Polling started for ${this.getUrls()}`);
    this.fetch();
  }

  stopPolling() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      this.logger.info(`Polling stopped for ${this.getUrls()}`);
    }
  }

  isPolling(): boolean {
    return this.intervalId !== undefined ? true : false;
  }
}
