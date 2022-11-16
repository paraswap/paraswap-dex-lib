import { Logger } from 'log4js';
import { AbstractWebsocketClient } from './abstract-websocket-client';
import { WebsocketConfig } from './types';

export class WebsocketClient<T> extends AbstractWebsocketClient<T> {
  constructor(
    private name: string,
    logger: Logger,
    private options: WebsocketConfig<T>,
    private onWSMessage: (name: string, msg: T) => void,
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
  }

  onMessage(msg: T): void {
    this.logger.debug(`${this.name} received msg ${msg}`);
    this.onWSMessage(this.name, msg);
  }

  stop() {
    super.stop();
  }
}
