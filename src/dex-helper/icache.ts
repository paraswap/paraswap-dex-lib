export interface ICache {
  get(
    dexKey: string,
    network: number,
    cacheKey: string,
  ): Promise<string | null>;

  rawget(key: string): Promise<string | null>;

  rawset(key: string, value: string, ttl: number): Promise<string | null>;

  rawdel(key: string): Promise<void>;

  del(dexKey: string, network: number, cacheKey: string): Promise<number>;

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

  zadd(
    key: string,
    bulkItemsToAdd: (number | string)[],
    option?: 'NX',
  ): Promise<number>;

  zremrangebyscore(key: string, min: number, max: number): Promise<number>;

  zscore(setKey: string, key: string): Promise<string | null>;

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
