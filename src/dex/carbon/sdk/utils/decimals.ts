export type DecimalFetcher = (
  address: string,
) => Promise<number | undefined> | number | undefined;

export class Decimals {
  private _fetcher: DecimalFetcher;
  private _cachedDecimals = new Map<string, number>();

  public constructor(fetcher: DecimalFetcher) {
    this._fetcher = fetcher;
  }

  public async fetchDecimals(address: string): Promise<number> {
    let decimal = this._cachedDecimals.get(address);
    if (decimal !== undefined) return decimal;

    decimal = await this._fetcher(address);
    if (decimal === undefined) {
      throw new Error(`Could not fetch decimals for token ${address}`);
    }

    this._cachedDecimals.set(address, decimal);

    return decimal;
  }
}
