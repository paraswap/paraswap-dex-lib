'use strict';
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator['throw'](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
var __generator =
  (this && this.__generator) ||
  function (thisArg, body) {
    var _ = {
        label: 0,
        sent: function () {
          if (t[0] & 1) throw t[1];
          return t[1];
        },
        trys: [],
        ops: [],
      },
      f,
      y,
      t,
      g;
    return (
      (g = { next: verb(0), throw: verb(1), return: verb(2) }),
      typeof Symbol === 'function' &&
        (g[Symbol.iterator] = function () {
          return this;
        }),
      g
    );
    function verb(n) {
      return function (v) {
        return step([n, v]);
      };
    }
    function step(op) {
      if (f) throw new TypeError('Generator is already executing.');
      while ((g && ((g = 0), op[0] && (_ = 0)), _))
        try {
          if (
            ((f = 1),
            y &&
              (t =
                op[0] & 2
                  ? y['return']
                  : op[0]
                  ? y['throw'] || ((t = y['return']) && t.call(y), 0)
                  : y.next) &&
              !(t = t.call(y, op[1])).done)
          )
            return t;
          if (((y = 0), t)) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (
                !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                (op[0] === 6 || op[0] === 2)
              ) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
      if (op[0] & 5) throw op[1];
      return { value: op[0] ? op[1] : void 0, done: true };
    }
  };
var __spreadArray =
  (this && this.__spreadArray) ||
  function (to, from, pack) {
    if (pack || arguments.length === 2)
      for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
          if (!ar) ar = Array.prototype.slice.call(from, 0, i);
          ar[i] = from[i];
        }
      }
    return to.concat(ar || Array.prototype.slice.call(from));
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.ChainSync = void 0;
var utils_1 = require('./utils');
var logger_1 = require('../common/logger');
var logger = new logger_1.Logger('index.ts');
var BLOCKS_TO_KEEP = 3;
var ChainSync = /** @class */ (function () {
  function ChainSync(fetcher, chainCache) {
    this._syncCalled = false;
    this._slowPollPairs = false;
    this._pairs = [];
    // keep the time stamp of last fetch
    this._lastFetch = Date.now();
    this._initialSyncDone = false;
    this._fetcher = fetcher;
    this._chainCache = chainCache;
  }
  ChainSync.prototype.startDataSync = function () {
    return __awaiter(this, arguments, void 0, function () {
      var blockNumber;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            logger.debug('startDataSync called');
            if (this._syncCalled) {
              throw new Error(
                'ChainSync.startDataSync() can only be called once',
              );
            }
            this._syncCalled = true;
            return [4 /*yield*/, this._fetcher.getBlockNumber()];
          case 1:
            blockNumber = _a.sent();
            if (this._chainCache.getLatestBlockNumber() === 0) {
              logger.debug('startDataSync - cache is new', arguments);
              // cache starts from scratch so we want to avoid getting events from the beginning of time
              this._chainCache.applyBatchedUpdates(blockNumber, [], [], [], []);
            }
            return [
              4 /*yield*/,
              Promise.all([
                this._trackFees(),
                this._populatePairsData(),
                this._syncEvents(),
              ]),
            ];
          case 2:
            _a.sent();
            return [2 /*return*/];
        }
      });
    });
  };
  ChainSync.prototype._trackFees = function () {
    return __awaiter(this, void 0, void 0, function () {
      var tradingFeePPM;
      var _this = this;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            logger.debug('_trackFees called');
            return [4 /*yield*/, this._fetcher.tradingFeePPM()];
          case 1:
            tradingFeePPM = _a.sent();
            this._chainCache.tradingFeePPM = tradingFeePPM;
            this._fetcher.onTradingFeePPMUpdated(function (
              prevFeePPM,
              newFeePPM,
            ) {
              logger.debug(
                'tradingFeePPM updated from',
                prevFeePPM,
                'to',
                newFeePPM,
              );
              _this._chainCache.tradingFeePPM = newFeePPM;
            });
            return [2 /*return*/];
        }
      });
    });
  };
  // `_populatePairsData` sets timeout and returns immediately. It does the following:
  // 1. Fetches all token pairs from the fetcher
  // 2. selects a pair that's not in the cache
  // 3. fetches strategies for the pair
  // 4. adds the pair to the cache
  // 5. sets short timeout to continue with the next pair
  // 6. if there are no more pairs, it sets a timeout to call itself again
  ChainSync.prototype._populatePairsData = function () {
    return __awaiter(this, void 0, void 0, function () {
      var processPairs;
      var _this = this;
      return __generator(this, function (_a) {
        logger.debug('_populatePairsData called');
        this._pairs = [];
        // keep the time stamp of last fetch
        this._lastFetch = Date.now();
        // this indicates we want to poll for pairs only once a minute.
        // Set this to false when we have an indication that new pair was created - which we want to fetch now
        this._slowPollPairs = false;
        processPairs = function () {
          return __awaiter(_this, void 0, void 0, function () {
            var _a, _b, nextPairToSync, e_1;
            var _this = this;
            return __generator(this, function (_c) {
              switch (_c.label) {
                case 0:
                  _c.trys.push([0, 6, , 7]);
                  if (!(this._pairs.length === 0)) return [3 /*break*/, 2];
                  // if we have no pairs we need to fetch - unless we're in slow poll mode and less than a minute has passed since last fetch
                  if (
                    this._slowPollPairs &&
                    Date.now() - this._lastFetch < 60000
                  ) {
                    // go back to sleep
                    setTimeout(processPairs, 1000);
                    return [2 /*return*/];
                  }
                  logger.debug('_populatePairsData fetches pairs');
                  _a = this;
                  _b = [[]];
                  return [4 /*yield*/, this._fetcher.pairs()];
                case 1:
                  _a._pairs = __spreadArray.apply(
                    void 0,
                    _b.concat([_c.sent(), true]),
                  );
                  logger.debug('_populatePairsData fetched pairs', this._pairs);
                  this._lastFetch = Date.now();
                  _c.label = 2;
                case 2:
                  nextPairToSync = (0, utils_1.findAndRemoveLeading)(
                    this._pairs,
                    function (pair) {
                      return !_this._chainCache.hasCachedPair(pair[0], pair[1]);
                    },
                  );
                  if (!nextPairToSync) return [3 /*break*/, 4];
                  logger.debug(
                    '_populatePairsData adds pair to cache',
                    nextPairToSync,
                  );
                  // we have a pair to sync - let's do it - add its strategies to the cache and then to minimal timeout to process the next pair
                  return [
                    4 /*yield*/,
                    this.syncPairData(
                      nextPairToSync[0],
                      nextPairToSync[1],
                      !this._initialSyncDone,
                    ),
                  ];
                case 3:
                  // we have a pair to sync - let's do it - add its strategies to the cache and then to minimal timeout to process the next pair
                  _c.sent();
                  setTimeout(processPairs, 1);
                  return [3 /*break*/, 5];
                case 4:
                  // list is now empty and there are no more pairs to sync - we can poll them less frequently
                  // we will wake up once a second just to check if we're still in slow poll mode,
                  // but if not - we will actually poll once a minute
                  logger.debug(
                    '_populatePairsData handled all pairs and goes to slow poll mode',
                  );
                  this._slowPollPairs = true;
                  this._initialSyncDone = true;
                  setTimeout(processPairs, 1000);
                  _c.label = 5;
                case 5:
                  return [3 /*break*/, 7];
                case 6:
                  e_1 = _c.sent();
                  logger.error('Error while syncing pairs data', e_1);
                  setTimeout(processPairs, 60000);
                  return [3 /*break*/, 7];
                case 7:
                  return [2 /*return*/];
              }
            });
          });
        };
        setTimeout(processPairs, 1);
        return [2 /*return*/];
      });
    });
  };
  ChainSync.prototype.syncPairData = function (
    token0,
    token1,
    noPairAddedEvent,
  ) {
    if (noPairAddedEvent === void 0) {
      noPairAddedEvent = false;
    }
    return __awaiter(this, void 0, void 0, function () {
      var strategies;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            if (!this._syncCalled) {
              throw new Error(
                'ChainSync.startDataSync() must be called before syncPairData()',
              );
            }
            return [
              4 /*yield*/,
              this._fetcher.strategiesByPair(token0, token1),
            ];
          case 1:
            strategies = _a.sent();
            if (this._chainCache.hasCachedPair(token0, token1))
              return [2 /*return*/];
            this._chainCache.addPair(
              token0,
              token1,
              strategies,
              noPairAddedEvent,
            );
            return [2 /*return*/];
        }
      });
    });
  };
  // used to break the blocks between latestBlock + 1 and currentBlock to chunks of 1000 blocks
  ChainSync.prototype._getBlockChunks = function (
    startBlock,
    endBlock,
    chunkSize,
  ) {
    var blockChunks = [];
    for (var i = startBlock; i <= endBlock; i += chunkSize) {
      var chunkStart = i;
      var chunkEnd = Math.min(i + chunkSize - 1, endBlock);
      blockChunks.push([chunkStart, chunkEnd]);
    }
    return blockChunks;
  };
  ChainSync.prototype._syncEvents = function () {
    return __awaiter(this, void 0, void 0, function () {
      var interval, processEvents;
      var _this = this;
      return __generator(this, function (_a) {
        logger.debug('_syncEvents called');
        interval = 1000;
        processEvents = function () {
          return __awaiter(_this, void 0, void 0, function () {
            var latestBlock,
              currentBlock,
              cachedPairs_1,
              blockChunks,
              createdStrategiesChunks,
              updatedStrategiesChunks,
              deletedStrategiesChunks,
              tradesChunks,
              _i,
              blockChunks_1,
              blockChunk,
              createdStrategiesChunk,
              updatedStrategiesChunk,
              deletedStrategiesChunk,
              tradesChunk,
              createdStrategies,
              updatedStrategies,
              deletedStrategies,
              trades,
              _a,
              createdStrategies_1,
              strategy,
              err_1;
            return __generator(this, function (_b) {
              switch (_b.label) {
                case 0:
                  _b.trys.push([0, 11, , 12]);
                  latestBlock = this._chainCache.getLatestBlockNumber();
                  return [4 /*yield*/, this._fetcher.getBlockNumber()];
                case 1:
                  currentBlock = _b.sent();
                  if (!(currentBlock > latestBlock)) return [3 /*break*/, 10];
                  return [4 /*yield*/, this._detectReorg(currentBlock)];
                case 2:
                  if (_b.sent()) {
                    logger.debug('_syncEvents detected reorg - resetting');
                    this._chainCache.clear();
                    this._chainCache.applyBatchedUpdates(
                      currentBlock,
                      [],
                      [],
                      [],
                      [],
                    );
                    this._resetPairsFetching();
                    setTimeout(processEvents, 1);
                    return [2 /*return*/];
                  }
                  cachedPairs_1 = new Set(
                    this._chainCache.getCachedPairs().map(function (pair) {
                      return (0, utils_1.toPairKey)(pair[0], pair[1]);
                    }),
                  );
                  logger.debug(
                    '_syncEvents fetches events',
                    latestBlock + 1,
                    currentBlock,
                  );
                  blockChunks = this._getBlockChunks(
                    latestBlock + 1,
                    currentBlock,
                    1000,
                  );
                  logger.debug('_syncEvents block chunks', blockChunks);
                  createdStrategiesChunks = [];
                  updatedStrategiesChunks = [];
                  deletedStrategiesChunks = [];
                  tradesChunks = [];
                  (_i = 0), (blockChunks_1 = blockChunks);
                  _b.label = 3;
                case 3:
                  if (!(_i < blockChunks_1.length)) return [3 /*break*/, 9];
                  blockChunk = blockChunks_1[_i];
                  logger.debug(
                    '_syncEvents fetches events for chunk',
                    blockChunk,
                  );
                  return [
                    4 /*yield*/,
                    this._fetcher.getLatestStrategyCreatedStrategies(
                      blockChunk[0],
                      blockChunk[1],
                    ),
                  ];
                case 4:
                  createdStrategiesChunk = _b.sent();
                  return [
                    4 /*yield*/,
                    this._fetcher.getLatestStrategyUpdatedStrategies(
                      blockChunk[0],
                      blockChunk[1],
                    ),
                  ];
                case 5:
                  updatedStrategiesChunk = _b.sent();
                  return [
                    4 /*yield*/,
                    this._fetcher.getLatestStrategyDeletedStrategies(
                      blockChunk[0],
                      blockChunk[1],
                    ),
                  ];
                case 6:
                  deletedStrategiesChunk = _b.sent();
                  return [
                    4 /*yield*/,
                    this._fetcher.getLatestTokensTradedTrades(
                      blockChunk[0],
                      blockChunk[1],
                    ),
                  ];
                case 7:
                  tradesChunk = _b.sent();
                  createdStrategiesChunks.push(createdStrategiesChunk);
                  updatedStrategiesChunks.push(updatedStrategiesChunk);
                  deletedStrategiesChunks.push(deletedStrategiesChunk);
                  tradesChunks.push(tradesChunk);
                  logger.debug(
                    '_syncEvents fetched the following events for chunks',
                    blockChunks,
                    {
                      createdStrategiesChunk: createdStrategiesChunk,
                      updatedStrategiesChunk: updatedStrategiesChunk,
                      deletedStrategiesChunk: deletedStrategiesChunk,
                      tradesChunk: tradesChunk,
                    },
                  );
                  _b.label = 8;
                case 8:
                  _i++;
                  return [3 /*break*/, 3];
                case 9:
                  createdStrategies = createdStrategiesChunks.flat();
                  updatedStrategies = updatedStrategiesChunks.flat();
                  deletedStrategies = deletedStrategiesChunks.flat();
                  trades = tradesChunks.flat();
                  logger.debug(
                    '_syncEvents fetched events',
                    createdStrategies,
                    updatedStrategies,
                    deletedStrategies,
                    trades,
                  );
                  // let's check created strategies and see if we have a pair that's not cached yet,
                  // which means we need to set slow poll mode to false so that it will be fetched quickly
                  for (
                    _a = 0, createdStrategies_1 = createdStrategies;
                    _a < createdStrategies_1.length;
                    _a++
                  ) {
                    strategy = createdStrategies_1[_a];
                    if (
                      !this._chainCache.hasCachedPair(
                        strategy.token0,
                        strategy.token1,
                      )
                    ) {
                      logger.debug(
                        '_syncEvents sets slow poll mode to false because of new pair',
                        strategy.token0,
                        strategy.token1,
                      );
                      this._slowPollPairs = false;
                      break;
                    }
                  }
                  this._chainCache.applyBatchedUpdates(
                    currentBlock,
                    trades.filter(function (trade) {
                      return cachedPairs_1.has(
                        (0, utils_1.toPairKey)(
                          trade.sourceToken,
                          trade.targetToken,
                        ),
                      );
                    }),
                    createdStrategies.filter(function (strategy) {
                      return cachedPairs_1.has(
                        (0, utils_1.toPairKey)(
                          strategy.token0,
                          strategy.token1,
                        ),
                      );
                    }),
                    updatedStrategies.filter(function (strategy) {
                      return cachedPairs_1.has(
                        (0, utils_1.toPairKey)(
                          strategy.token0,
                          strategy.token1,
                        ),
                      );
                    }),
                    deletedStrategies.filter(function (strategy) {
                      return cachedPairs_1.has(
                        (0, utils_1.toPairKey)(
                          strategy.token0,
                          strategy.token1,
                        ),
                      );
                    }),
                  );
                  _b.label = 10;
                case 10:
                  return [3 /*break*/, 12];
                case 11:
                  err_1 = _b.sent();
                  logger.error('Error syncing events:', err_1);
                  return [3 /*break*/, 12];
                case 12:
                  setTimeout(processEvents, interval);
                  return [2 /*return*/];
              }
            });
          });
        };
        setTimeout(processEvents, 1);
        return [2 /*return*/];
      });
    });
  };
  ChainSync.prototype._resetPairsFetching = function () {
    this._pairs = [];
    this._slowPollPairs = false;
    this._initialSyncDone = false;
  };
  ChainSync.prototype._detectReorg = function (currentBlock) {
    return __awaiter(this, void 0, void 0, function () {
      var blocksMetadata,
        numberToBlockMetadata,
        _i,
        blocksMetadata_1,
        blockMetadata,
        number,
        hash,
        currentHash,
        latestBlocksMetadata,
        i,
        _a,
        _b;
      return __generator(this, function (_c) {
        switch (_c.label) {
          case 0:
            logger.debug('_detectReorg called');
            blocksMetadata = this._chainCache.blocksMetadata;
            numberToBlockMetadata = {};
            (_i = 0), (blocksMetadata_1 = blocksMetadata);
            _c.label = 1;
          case 1:
            if (!(_i < blocksMetadata_1.length)) return [3 /*break*/, 4];
            blockMetadata = blocksMetadata_1[_i];
            (number = blockMetadata.number), (hash = blockMetadata.hash);
            if (number > currentBlock) {
              logger.log(
                'reorg detected for block number',
                number,
                'larger than current block',
                currentBlock,
                'with hash',
                hash,
              );
              return [2 /*return*/, true];
            }
            return [4 /*yield*/, this._fetcher.getBlock(number)];
          case 2:
            currentHash = _c.sent().hash;
            if (hash !== currentHash) {
              logger.log(
                'reorg detected for block number',
                number,
                'old hash',
                hash,
                'new hash',
                currentHash,
              );
              return [2 /*return*/, true];
            }
            // blockMetadata is valid, let's store it so that we don't have to fetch it again below
            numberToBlockMetadata[number] = blockMetadata;
            _c.label = 3;
          case 3:
            _i++;
            return [3 /*break*/, 1];
          case 4:
            // no reorg detected
            logger.debug(
              '_detectReorg no reorg detected, updating blocks metadata',
            );
            latestBlocksMetadata = [];
            i = 0;
            _c.label = 5;
          case 5:
            if (!(i < BLOCKS_TO_KEEP)) return [3 /*break*/, 9];
            if (!numberToBlockMetadata[currentBlock - i])
              return [3 /*break*/, 6];
            latestBlocksMetadata.push(numberToBlockMetadata[currentBlock - i]);
            return [3 /*break*/, 8];
          case 6:
            _b = (_a = latestBlocksMetadata).push;
            return [4 /*yield*/, this._fetcher.getBlock(currentBlock - i)];
          case 7:
            _b.apply(_a, [_c.sent()]);
            _c.label = 8;
          case 8:
            i++;
            return [3 /*break*/, 5];
          case 9:
            this._chainCache.blocksMetadata = latestBlocksMetadata;
            logger.debug('_detectReorg updated blocks metadata');
            return [2 /*return*/, false];
        }
      });
    });
  };
  return ChainSync;
})();
exports.ChainSync = ChainSync;
