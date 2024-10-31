import { Logger } from 'log4js';
import { RequestConfig, Response } from '../../dex-helper/irequest-wrapper';
import WebSocket from 'ws';
export class SkippingRequest {
  constructor(public message = '') {}
}

export type RequestInfo<T> = {
  requestFunc?: (
    options: RequestConfig,
  ) => Promise<Response<T> | SkippingRequest>;
  requestOptions: RequestConfig;
  caster: (data: unknown) => T;
  authenticate?: (options: RequestConfig) => RequestConfig;
  excludedFieldsCaching?: string[];
};

export type RequestInfoWithHandler<T> = {
  info: RequestInfo<T>;
  handler: (data: T) => void;
};

export class WebSocketFetcher<T> {
  private requests: RequestInfoWithHandler<T>;
  public lastFetchSucceeded: boolean = false;
  private stop: boolean = true;
  private connection: WebSocket | null = null;

  constructor(requestsInfo: RequestInfoWithHandler<T>, private logger: Logger) {
    this.requests = requestsInfo;
  }

  private connected() {
    this.logger.info(`Connected to ${this.requests.info.requestOptions.url}`);
  }

  private onClose() {
    // Do not reconnect if polling is stopped
    if (this.stop) return;

    this.logger.info(`Connection closed. Reconnecting...`);
    // reconnect on errors / failures
    setTimeout(() => {
      this.startPolling();
    }, 3000);
  }

  private onError(error: any) {
    this.logger.error(
      `Websocket Error: ${error.toString()}. Stopping & Reconnecting...`,
    );
  }

  private onMessage(data: WebSocket.RawData) {
    const reqInfo = this.requests;
    const info = reqInfo.info;
    const options = reqInfo.info.requestOptions;
    this.logger.debug(`(${options.url}) received new data`);

    try {
      const parsedData = info.caster(data);
      reqInfo.handler(parsedData);
    } catch (e) {
      this.logger.info(e);
      this.logger.info(
        `(${options.url}) received incorrect data ${JSON.stringify(
          data,
        ).replace(/(?:\r\n|\r|\n)/g, ' ')}`,
        e,
      );
      return;
    }
  }

  private connect() {
    const authorization =
      this.requests.info.requestOptions.headers!.authorization;
    const name = this.requests.info.requestOptions.headers!.name;
    if (typeof authorization !== 'string') {
      throw new Error('Authorization header is not a string');
    }
    if (typeof name !== 'string') {
      throw new Error('Name header is not a string');
    }
    this.logger.info(
      `Connecting to ${this.requests.info.requestOptions.url}...`,
    );
    const ws = new WebSocket(this.requests.info.requestOptions.url!, {
      headers: {
        Authorization: authorization,
        name: name,
      },
    });

    ws.on('open', this.connected.bind(this));
    ws.on('message', this.onMessage.bind(this));
    ws.on('error', this.onError.bind(this));
    ws.on('close', this.onClose.bind(this));
    this.connection = ws;
  }

  startPolling(): void {
    this.stop = false;
    this.connect();
    this.logger.info(
      `Connection started for ${this.requests.info.requestOptions.url}`,
    );
  }

  stopPolling() {
    this.stop = true;
    if (this.connection) {
      this.connection.close();
    }
    this.logger.info(
      `Connection stopped for ${this.requests.info.requestOptions.url}`,
    );
  }

  isPolling(): boolean {
    return !this.stop;
  }
}
