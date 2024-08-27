export class DexPoolNotFoundError extends Error {
  constructor(dexKey: string, poolIdentifier: string) {
    super(`Pool ${poolIdentifier} not found for DEX ${dexKey}`);
  }
}
