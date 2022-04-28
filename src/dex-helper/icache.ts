export interface ICache {
  getByKey(key: string): Promise<string | null>;

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
}
