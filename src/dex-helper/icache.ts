export interface ICache {
  get(key: string): Promise<string>;

  setex(key: string, seconds: number, value: string): Promise<void>;
}
