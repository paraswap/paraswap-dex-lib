import { Logger } from 'log4js';
import { RequestConfig, Response } from '../../dex-helper/irequest-wrapper';
import {
  connection as WebSocketConnection,
  client as WebSocketClient,
} from 'websocket';

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
  private ws: WebSocketClient = new WebSocketClient();
  private connection: WebSocketConnection | null = null;

  constructor(requestsInfo: RequestInfoWithHandler<T>, private logger: Logger) {
    this.requests = requestsInfo;
    this.ws.on('connect', this.connected.bind(this));
    this.ws.on('connectFailed', this.connectFailed.bind(this));
  }

  private connected(connection: WebSocketConnection) {
    this.connection = connection;
    this.logger.info(`Connected to ${this.requests.info.requestOptions.url}`);
    this.connection.on('error', this.onError.bind(this));
    this.connection.on('close', this.onClose.bind(this));
    this.connection.on('message', this.onMessage.bind(this));
  }

  private connectFailed(error: any) {
    this.logger.error(`Connect Error: ${error.toString()}. Reconnecting...`);
    // reconnect on errors / failures
    setTimeout(() => {
      this.startPolling();
    }, 3000);
  }

  private onClose() {
    this.logger.info(`Connection closed. Reconnecting...`);
    // reconnect on errors / failures
    setTimeout(() => {
      this.startPolling();
    }, 3000);
  }

  private onError(error: any) {
    this.logger.error(
      `Connection Error: ${error.toString()}. Stopping & Reconnecting...`,
    );
    this.stopPolling();

    // reconnect on errors / failures
    setTimeout(() => {
      this.startPolling();
    }, 3000);
  }

  private onMessage(message: any) {
    if (message.type === 'utf8') {
      const response = JSON.parse(message.utf8Data) as Response<T>;
      const reqInfo = this.requests;
      const info = reqInfo.info;
      const options = reqInfo.info.requestOptions;
      this.logger.debug(`(${options.url}) received new data`);

      try {
        const parsedData = info.caster(response);
        reqInfo.handler(parsedData);
      } catch (e) {
        this.logger.info(e);
        this.logger.info(
          `(${options.url}) received incorrect data ${JSON.stringify(
            response,
          ).replace(/(?:\r\n|\r|\n)/g, ' ')}`,
          e,
        );
        return;
      }
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
    this.ws.connect(
      this.requests.info.requestOptions.url!,
      undefined,
      undefined,
      {
        Authorization: authorization,
        name: name,
      },
    );
  }

  startPolling(): void {
    this.stop = false;
    this.connect();
    this.logger.info(
      `Connection started for ${this.requests.info.requestOptions.url}`,
    );
  }

  stopPolling() {
    if (this.connection) {
      this.connection.close();
    }
    this.stop = true;
    this.logger.info(
      `Connection stopped for ${this.requests.info.requestOptions.url}`,
    );
  }

  isPolling(): boolean {
    return !this.stop;
  }
}
