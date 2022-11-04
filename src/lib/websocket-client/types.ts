export type WebsocketConfig<T> = {
  url: string;
  initPayloads?: T[];
  reconnectDelayMs: number;
  keepAliveDealyMs: number;
};
