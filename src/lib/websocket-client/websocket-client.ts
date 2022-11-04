import { Logger } from 'log4js';
import Fetcher from '../fetcher/fetcher';
import { AbstractWebsocketClient } from './abstract-websocket-client';
import { WebsocketConfig } from './types';

export class WebsocketClientWithHttpFallback<
  T,
> extends AbstractWebsocketClient<T> {
  constructor(
    private name: string,
    logger: Logger,
    private options: WebsocketConfig<T>,
    private onWSMessage: (name: string, msg: T) => void,
    private fetcher?: Fetcher<any>,
  ) {
    super(
      `${options.url}`,
      options.keepAliveDealyMs,
      options.reconnectDelayMs,
      logger,
    );
  }

  onOpen() {
    this.logger.info('Websocket connected waiting for message');
    if (this.options.initPayloads) {
      for (const option of this.options.initPayloads) {
        this.broadcastMessage(option, false);
      }
    }
  }

  onClose() {
    this.logger.info('Websocket disconnected');
    if (this.fetcher) {
      this.logger.info(`${this.name} enable http fallback`);
      this.fetcher.startPolling();
    }
  }

  onMessage(msg: T): void {
    if (this.fetcher && this.fetcher.isPolling()) {
      this.fetcher.stopPolling();
      this.logger.info(`${this.name} disable http fallback`);
    }
    this.logger.debug(`${this.name} received msg ${msg}`);
    this.onWSMessage(this.name, msg);
  }

  stop() {
    super.stop();
    if (this.fetcher) {
      this.fetcher.stopPolling();
    }
  }
}
