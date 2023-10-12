import { Fetcher } from '../common/types';
import { ChainCache } from './ChainCache';
import { ChainSync } from './ChainSync';

export { ChainCache, ChainSync };
export * from './types';

/**
 * Initializes a cache and a syncer for the cache - this default initialization logic
 * can be used in most cases. If you need to customize the initialization logic, you can
 * use the ChainCache and ChainSync classes directly.
 * @param {Fetcher} fetcher - fetcher to use for syncing the cache
 * @param {string} cachedData - serialized cache data to initialize the cache with
 * @returns an object with the initialized cache and a function to start syncing the cache
 * @example
 * const { cache, startDataSync } = initSyncedCache(fetcher, cachedData);
 * await startDataSync();
 * // cache is now synced
 */
export const initSyncedCache = (
  fetcher: Fetcher,
  cachedData?: string,
): { cache: ChainCache; startDataSync: () => Promise<void> } => {
  let cache: ChainCache | undefined;
  if (cachedData) {
    cache = ChainCache.fromSerialized(cachedData);
  }
  // either serialized data was bad or it was not provided
  if (!cache) {
    cache = new ChainCache();
  }

  const syncer = new ChainSync(fetcher, cache);
  cache.setCacheMissHandler(syncer.syncPairData.bind(syncer));
  return { cache, startDataSync: syncer.startDataSync.bind(syncer) };
};
