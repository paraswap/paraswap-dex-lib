'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __exportStar =
  (this && this.__exportStar) ||
  function (m, exports) {
    for (var p in m)
      if (p !== 'default' && !Object.prototype.hasOwnProperty.call(exports, p))
        __createBinding(exports, m, p);
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.initSyncedCache = exports.ChainSync = exports.ChainCache = void 0;
var ChainCache_1 = require('./ChainCache');
Object.defineProperty(exports, 'ChainCache', {
  enumerable: true,
  get: function () {
    return ChainCache_1.ChainCache;
  },
});
var ChainSync_1 = require('./ChainSync');
Object.defineProperty(exports, 'ChainSync', {
  enumerable: true,
  get: function () {
    return ChainSync_1.ChainSync;
  },
});
__exportStar(require('./types'), exports);
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
var initSyncedCache = function (fetcher, cachedData) {
  var cache;
  if (cachedData) {
    cache = ChainCache_1.ChainCache.fromSerialized(cachedData);
  }
  // either serialized data was bad or it was not provided
  if (!cache) {
    cache = new ChainCache_1.ChainCache();
  }
  var syncer = new ChainSync_1.ChainSync(fetcher, cache);
  cache.setCacheMissHandler(syncer.syncPairData.bind(syncer));
  return { cache: cache, startDataSync: syncer.startDataSync.bind(syncer) };
};
exports.initSyncedCache = initSyncedCache;
