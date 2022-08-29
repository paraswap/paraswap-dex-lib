export interface ICache {
  isSyncing: boolean;

  get(
    dexKey: string,
    network: number,
    cacheKey: string,
  ): Promise<string | null>;

  setex(
    dexKey: string,
    network: number,
    cacheKey: string,
    seconds: number,
    value: string,
  ): Promise<void>;

  hset(mapKey: string, key: string, value: string): Promise<void>;
  hget(mapKey: string, key: string): Promise<string | null>;

  publish(channel: string, msg: string): Promise<void>;
  subscribe(
    channel: string,
    cb: (channel: string, msg: string) => void,
  ): () => void;
}
