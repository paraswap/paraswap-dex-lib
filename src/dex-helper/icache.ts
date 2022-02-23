export interface ICache {
  get(key: string): Promise<string | null>;

  setex(key: string, seconds: number, value: string): Promise<void>;
}
