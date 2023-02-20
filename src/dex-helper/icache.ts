export interface ICache {
  get(
    dexKey: string,
    network: number,
    cacheKey: string,
  ): Promise<string | null>;

  rawget(key: string): Promise<string | null>;

  rawdel(key: string): Promise<void>;

  setex(
    dexKey: string,
    network: number,
    cacheKey: string,
    ttlSeconds: number,
    value: string,
  ): Promise<void>;

  getAndCacheLocally(
    dexKey: string,
    network: number,
    cacheKey: string,
    ttlSeconds: number,
  ): Promise<string | null>;

  setexAndCacheLocally(
    dexKey: string,
    network: number,
    cacheKey: string,
    ttlSeconds: number,
    value: string,
  ): Promise<void>;

  sadd(setKey: string, key: string): Promise<void>;

  sismember(setKey: string, key: string): Promise<boolean>;

  hset(mapKey: string, key: string, value: string): Promise<void>;

  hdel(mapKey: string, keys: string[]): Promise<number>;

  hget(mapKey: string, key: string): Promise<string | null>;

  hgetAll(mapKey: string): Promise<Record<string, string>>;

  publish(channel: string, msg: string): Promise<void>;

  subscribe(
    channel: string,
    cb: (channel: string, msg: string) => void,
  ): () => void;

  addBatchHGet(
    mapKey: string,
    key: string,
    cb: (result: string | null) => boolean,
  ): void;
}
