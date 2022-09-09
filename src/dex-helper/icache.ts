export interface ICache {
  get(
    dexKey: string,
    network: number,
    cacheKey: string,
  ): Promise<string | null>;

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
}
