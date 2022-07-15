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
    seconds: number,
    value: string,
  ): Promise<void>;

  rawsetex(key: string, value: string): Promise<void>;
  rawget(key: string): Promise<string | null>;

  publish(channel: string, msg: string): Promise<void>;
  subscribe(
    channel: string,
    cb: (channel: string, msg: string) => void,
  ): () => void;
}
