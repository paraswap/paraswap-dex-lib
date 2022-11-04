import { Logger } from 'log4js';
import WebSocket from 'ws';

export abstract class AbstractWebsocketClient<TMessage> {
  private ws?: WebSocket;
  private wsConnected = false;
  private pingInterval?: ReturnType<typeof setInterval>;

  private startPromise?: Promise<void>;
  public resolveStartPromise?: (value: void | PromiseLike<void>) => void;

  constructor(
    private url: string,
    private pingMs: number,
    private reconnectDelayMs: number,
    protected logger: Logger,
  ) {}

  abstract onOpen(): void;
  abstract onClose(): void;
  abstract onMessage(msg: TMessage): void;

  // Resolves when an initial BlockNumber message is received
  startListening(): Promise<void> {
    if (!this.startPromise) {
      this.startPromise = new Promise<void>(resolve => {
        this.resolveStartPromise = resolve;
        this.connectWebSocket();
      });
    }
    return this.startPromise;
  }

  private connectWebSocket() {
    this.ws = new WebSocket(this.url);
    this.wsConnected = false;

    this.pingInterval = setInterval(() => {
      if (this.ws!.readyState === WebSocket.OPEN) {
        this.ws!.ping();
      }
    }, this.pingMs);

    this.ws.on('open', this.open.bind(this));
    this.ws.on('error', this.error.bind(this));
    this.ws.on('message', this.message.bind(this));
    this.ws.on('close', this.close.bind(this));
  }

  private open() {
    this.logger.debug(`${this.url} connected`);
    this.wsConnected = true;
    this.onOpen();
  }

  private error(e: Error) {
    this.logger.debug(`${this.url} got error: ${e}`);
  }

  private message(data: string) {
    const msg: TMessage = JSON.parse(data.toString());
    this.onMessage(msg);
  }

  private close(code: number, reason: string) {
    this.logger.debug(
      `${this.url} disconnected (code=${code}, reason=${reason})`,
    );
    this.wsConnected = false;
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.onClose();

    if (this.reconnectDelayMs !== 0) {
      setTimeout(() => {
        this.logger.debug(
          `${this.url} try to reconnect [each ${this.reconnectDelayMs}ms]`,
        );
        this.connectWebSocket();
      }, this.reconnectDelayMs);
    }
  }

  broadcastMessage(message: TMessage, encode: boolean = true) {
    if (!this.ws) {
      throw new Error('WebSocket not initialized');
    }

    if (encode) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.ws.send(message);
    }
  }

  stop() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }

    if (!this.ws) {
      throw new Error('WebSocket not initialized');
    }

    this.reconnectDelayMs = 0;
    if (this.wsConnected) {
      this.ws.close();
    }
  }
}
