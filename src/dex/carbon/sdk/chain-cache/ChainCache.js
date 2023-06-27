'use strict';
var __extends =
  (this && this.__extends) ||
  (function () {
    var extendStatics = function (d, b) {
      extendStatics =
        Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array &&
          function (d, b) {
            d.__proto__ = b;
          }) ||
        function (d, b) {
          for (var p in b)
            if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p];
        };
      return extendStatics(d, b);
    };
    return function (d, b) {
      if (typeof b !== 'function' && b !== null)
        throw new TypeError(
          'Class extends value ' + String(b) + ' is not a constructor or null',
        );
      extendStatics(d, b);
      function __() {
        this.constructor = d;
      }
      d.prototype =
        b === null
          ? Object.create(b)
          : ((__.prototype = b.prototype), new __());
    };
  })();
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
Object.defineProperty(exports, '__esModule', { value: true });
exports.ChainCache = void 0;
var events_1 = require('events');
var utils_1 = require('./utils');
var serializers_1 = require('../utils/serializers');
var logger_1 = require('../common/logger');
var logger = new logger_1.Logger('ChainCache.ts');
var schemeVersion = 4; // bump this when the serialization format changes
var ChainCache = /** @class */ (function (_super) {
  __extends(ChainCache, _super);
  function ChainCache() {
    var _this = (_super !== null && _super.apply(this, arguments)) || this;
    //#region private members
    _this._strategiesByPair = {};
    _this._strategiesById = {};
    _this._ordersByDirectedPair = {};
    _this._latestBlockNumber = 0;
    _this._latestTradesByPair = {};
    _this._latestTradesByDirectedPair = {};
    _this._blocksMetadata = [];
    return _this;
    //#endregion cache updates
  }
  //#endregion private members
  //#region serialization for persistent caching
  ChainCache.fromSerialized = function (serializedCache) {
    try {
      var cache = new ChainCache();
      cache._deserialize(serializedCache);
      return cache;
    } catch (e) {
      logger.error('Failed to deserialize cache, returning clear cache', e);
    }
    return new ChainCache();
  };
  ChainCache.prototype._deserialize = function (serializedCache) {
    var parsedCache = JSON.parse(serializedCache);
    var version = parsedCache.schemeVersion;
    if (version !== schemeVersion) {
      logger.log(
        'Cache version mismatch, ignoring cache. Expected',
        schemeVersion,
        'got',
        version,
        'This may be due to a breaking change in the cache format since it was last persisted.',
      );
      return;
    }
    this._strategiesByPair = Object.entries(
      parsedCache.strategiesByPair,
    ).reduce(function (acc, _a) {
      var key = _a[0],
        strategies = _a[1];
      acc[key] = strategies.map(serializers_1.encodedStrategyStrToBN);
      return acc;
    }, {});
    this._strategiesById = Object.entries(parsedCache.strategiesById).reduce(
      function (acc, _a) {
        var key = _a[0],
          strategy = _a[1];
        acc[key] = (0, serializers_1.encodedStrategyStrToBN)(strategy);
        return acc;
      },
      {},
    );
    this._ordersByDirectedPair = Object.entries(
      parsedCache.ordersByDirectedPair,
    ).reduce(function (acc, _a) {
      var directedPairKey = _a[0],
        orderMap = _a[1];
      acc[directedPairKey] = Object.entries(orderMap).reduce(function (
        acc,
        _a,
      ) {
        var strategyId = _a[0],
          order = _a[1];
        acc[strategyId] = (0, serializers_1.encodedOrderStrToBN)(order);
        return acc;
      },
      {});
      return acc;
    }, {});
    this._latestBlockNumber = parsedCache.latestBlockNumber;
    this._latestTradesByPair = parsedCache.latestTradesByPair;
    this._latestTradesByDirectedPair = parsedCache.latestTradesByDirectedPair;
    this._blocksMetadata = parsedCache.blocksMetadata;
  };
  ChainCache.prototype.serialize = function () {
    var dump = {
      schemeVersion: schemeVersion,
      strategiesByPair: Object.entries(this._strategiesByPair).reduce(function (
        acc,
        _a,
      ) {
        var key = _a[0],
          strategies = _a[1];
        acc[key] = strategies.map(serializers_1.encodedStrategyBNToStr);
        return acc;
      },
      {}),
      strategiesById: Object.entries(this._strategiesById).reduce(function (
        acc,
        _a,
      ) {
        var key = _a[0],
          strategy = _a[1];
        acc[key] = (0, serializers_1.encodedStrategyBNToStr)(strategy);
        return acc;
      },
      {}),
      ordersByDirectedPair: Object.entries(this._ordersByDirectedPair).reduce(
        function (acc, _a) {
          var directedPairKey = _a[0],
            orderMap = _a[1];
          acc[directedPairKey] = Object.entries(orderMap).reduce(function (
            acc,
            _a,
          ) {
            var strategyId = _a[0],
              order = _a[1];
            acc[strategyId] = (0, serializers_1.encodedOrderBNToStr)(order);
            return acc;
          },
          {});
          return acc;
        },
        {},
      ),
      latestBlockNumber: this._latestBlockNumber,
      latestTradesByPair: this._latestTradesByPair,
      latestTradesByDirectedPair: this._latestTradesByDirectedPair,
      blocksMetadata: this._blocksMetadata,
    };
    return JSON.stringify(dump);
  };
  //#endregion serialization for persistent caching
  ChainCache.prototype.setCacheMissHandler = function (handler) {
    this._handleCacheMiss = handler;
  };
  ChainCache.prototype._checkAndHandleCacheMiss = function (token0, token1) {
    return __awaiter(this, void 0, void 0, function () {
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            if (!this._handleCacheMiss || this.hasCachedPair(token0, token1))
              return [2 /*return*/];
            logger.debug('Cache miss for pair', token0, token1);
            return [4 /*yield*/, this._handleCacheMiss(token0, token1)];
          case 1:
            _a.sent();
            logger.debug('Cache miss for pair', token0, token1, 'resolved');
            return [2 /*return*/];
        }
      });
    });
  };
  ChainCache.prototype.clear = function () {
    var pairs = Object.keys(this._strategiesByPair).map(utils_1.fromPairKey);
    this._strategiesByPair = {};
    this._strategiesById = {};
    this._ordersByDirectedPair = {};
    this._latestBlockNumber = 0;
    this._latestTradesByPair = {};
    this._latestTradesByDirectedPair = {};
    this._blocksMetadata = [];
    this.emit('onPairDataChanged', pairs);
  };
  ChainCache.prototype.getStrategiesByPair = function (token0, token1) {
    return __awaiter(this, void 0, void 0, function () {
      var key;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            return [4 /*yield*/, this._checkAndHandleCacheMiss(token0, token1)];
          case 1:
            _a.sent();
            key = (0, utils_1.toPairKey)(token0, token1);
            return [2 /*return*/, this._strategiesByPair[key]];
        }
      });
    });
  };
  ChainCache.prototype.getStrategyById = function (id) {
    return this._strategiesById[id.toString()];
  };
  ChainCache.prototype.getCachedPairs = function (onlyWithStrategies) {
    if (onlyWithStrategies === void 0) {
      onlyWithStrategies = true;
    }
    if (onlyWithStrategies) {
      return Object.entries(this._strategiesByPair)
        .filter(function (_a) {
          var _ = _a[0],
            strategies = _a[1];
          return strategies.length > 0;
        })
        .map(function (_a) {
          var key = _a[0],
            _ = _a[1];
          return (0, utils_1.fromPairKey)(key);
        });
    }
    return Object.keys(this._strategiesByPair).map(utils_1.fromPairKey);
  };
  /**
   * returns the orders that sell targetToken for sourceToken
   */
  ChainCache.prototype.getOrdersByPair = function (
    sourceToken,
    targetToken,
    keepNonTradable,
  ) {
    if (keepNonTradable === void 0) {
      keepNonTradable = false;
    }
    return __awaiter(this, void 0, void 0, function () {
      var key, orders;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            return [
              4 /*yield*/,
              this._checkAndHandleCacheMiss(sourceToken, targetToken),
            ];
          case 1:
            _a.sent();
            key = (0, utils_1.toDirectionKey)(sourceToken, targetToken);
            orders = this._ordersByDirectedPair[key] || {};
            if (keepNonTradable) return [2 /*return*/, orders];
            return [
              2 /*return*/,
              Object.fromEntries(
                Object.entries(orders).filter(function (_a) {
                  var _ = _a[0],
                    order = _a[1];
                  return (0, utils_1.isOrderTradable)(order);
                }),
              ),
            ];
        }
      });
    });
  };
  ChainCache.prototype.hasCachedPair = function (token0, token1) {
    var key = (0, utils_1.toPairKey)(token0, token1);
    return !!this._strategiesByPair[key];
  };
  ChainCache.prototype.getLatestTradeByPair = function (token0, token1) {
    return __awaiter(this, void 0, void 0, function () {
      var key;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            return [4 /*yield*/, this._checkAndHandleCacheMiss(token0, token1)];
          case 1:
            _a.sent();
            key = (0, utils_1.toPairKey)(token0, token1);
            return [2 /*return*/, this._latestTradesByPair[key]];
        }
      });
    });
  };
  ChainCache.prototype.getLatestTradeByDirectedPair = function (
    sourceToken,
    targetToken,
  ) {
    return __awaiter(this, void 0, void 0, function () {
      var key;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            return [
              4 /*yield*/,
              this._checkAndHandleCacheMiss(sourceToken, targetToken),
            ];
          case 1:
            _a.sent();
            key = (0, utils_1.toDirectionKey)(sourceToken, targetToken);
            return [2 /*return*/, this._latestTradesByDirectedPair[key]];
        }
      });
    });
  };
  ChainCache.prototype.getLatestTrades = function () {
    return Object.values(this._latestTradesByPair);
  };
  ChainCache.prototype.getLatestBlockNumber = function () {
    return this._latestBlockNumber;
  };
  Object.defineProperty(ChainCache.prototype, 'blocksMetadata', {
    get: function () {
      return this._blocksMetadata;
    },
    set: function (blocks) {
      this._blocksMetadata = blocks;
    },
    enumerable: false,
    configurable: true,
  });
  //#endregion public getters
  //#region cache updates
  /**
   * This method is to be used when all the existing strategies of a pair are
   * fetched and are to be stored in the cache.
   * Once a pair is cached, the only way to update it is by using `applyBatchedUpdates`.
   * If all the strategies of a pair are deleted, the pair remains in the cache and there's
   * no need to add it again.
   * @param {string} token0 - address of the first token of the pair
   * @param {string} token1 - address of the second token of the pair
   * @param {EncodedStrategy[]} strategies - the strategies to be cached
   * @throws {Error} if the pair is already cached
   * @returns {void}
   */
  ChainCache.prototype.addPair = function (
    token0,
    token1,
    strategies,
    noPairAddedEvent,
  ) {
    var _this = this;
    if (noPairAddedEvent === void 0) {
      noPairAddedEvent = false;
    }
    logger.debug('Adding pair to cache', token0, token1);
    var key = (0, utils_1.toPairKey)(token0, token1);
    if (this._strategiesByPair[key]) {
      throw new Error('Pair '.concat(key, ' already cached'));
    }
    this._strategiesByPair[key] = strategies;
    strategies.forEach(function (strategy) {
      _this._strategiesById[strategy.id.toString()] = strategy;
      _this._addStrategyOrders(strategy);
    });
    if (!noPairAddedEvent) {
      logger.debug('Emitting onPairAddedToCache', token0, token1);
      this.emit('onPairAddedToCache', (0, utils_1.fromPairKey)(key));
    }
  };
  /**
   * This method is to be used when events from a range of blocks are fetched
   * and are to be applied to the cache.
   * All the events should belong to pairs that are already cached.
   * The way to use this work flow is to first call `getLatestBlockNumber` to
   * get the latest block number that was already cached, then fetch all the
   * events from that block number to the latest block number, and finally
   * call this method with the fetched events.
   * Note: the cache can handle a case of a strategy that was created and then updated and then deleted
   * @param {number} latestBlockNumber - the latest block number that was fetched
   * @param {TradeData[]} latestTrades - the trades that were conducted
   * @param {EncodedStrategy[]} createdStrategies - the strategies that were created
   * @param {EncodedStrategy[]} updatedStrategies - the strategies that were updated
   * @param {EncodedStrategy[]} deletedStrategies - the strategies that were deleted
   * @throws {Error} if the pair of a strategy is not cached
   * @returns {void}
   */
  ChainCache.prototype.applyBatchedUpdates = function (
    latestBlockNumber,
    latestTrades,
    createdStrategies,
    updatedStrategies,
    deletedStrategies,
  ) {
    var _this = this;
    logger.debug('Applying batched updates to cache', {
      latestBlockNumber: latestBlockNumber,
      latestTrades: latestTrades,
      createdStrategies: createdStrategies,
      updatedStrategies: updatedStrategies,
      deletedStrategies: deletedStrategies,
    });
    var affectedPairs = new Set();
    latestTrades.forEach(function (trade) {
      _this._setLatestTrade(trade);
      affectedPairs.add(
        (0, utils_1.toPairKey)(trade.sourceToken, trade.targetToken),
      );
    });
    createdStrategies.forEach(function (strategy) {
      _this._addStrategy(strategy);
      affectedPairs.add(
        (0, utils_1.toPairKey)(strategy.token0, strategy.token1),
      );
    });
    updatedStrategies.forEach(function (strategy) {
      _this._updateStrategy(strategy);
      affectedPairs.add(
        (0, utils_1.toPairKey)(strategy.token0, strategy.token1),
      );
    });
    deletedStrategies.forEach(function (strategy) {
      _this._deleteStrategy(strategy);
      affectedPairs.add(
        (0, utils_1.toPairKey)(strategy.token0, strategy.token1),
      );
    });
    this._setLatestBlockNumber(latestBlockNumber);
    if (affectedPairs.size > 0) {
      logger.debug('Emitting onPairDataChanged', affectedPairs);
      this.emit(
        'onPairDataChanged',
        Array.from(affectedPairs).map(utils_1.fromPairKey),
      );
    }
  };
  ChainCache.prototype._setLatestBlockNumber = function (blockNumber) {
    this._latestBlockNumber = blockNumber;
  };
  ChainCache.prototype._setLatestTrade = function (trade) {
    if (!this.hasCachedPair(trade.sourceToken, trade.targetToken)) {
      throw new Error(
        'Pair '.concat(
          (0, utils_1.toPairKey)(trade.sourceToken, trade.targetToken),
          ' is not cached, cannot set latest trade',
        ),
      );
    }
    var key = (0, utils_1.toPairKey)(trade.sourceToken, trade.targetToken);
    this._latestTradesByPair[key] = trade;
    var directedKey = (0, utils_1.toDirectionKey)(
      trade.sourceToken,
      trade.targetToken,
    );
    this._latestTradesByDirectedPair[directedKey] = trade;
  };
  ChainCache.prototype._addStrategyOrders = function (strategy) {
    var _a;
    for (
      var _i = 0,
        _b = [
          [strategy.token0, strategy.token1],
          [strategy.token1, strategy.token0],
        ];
      _i < _b.length;
      _i++
    ) {
      var tokenOrder = _b[_i];
      var key = (0, utils_1.toDirectionKey)(tokenOrder[0], tokenOrder[1]);
      var order =
        tokenOrder[0] === strategy.token0 ? strategy.order1 : strategy.order0;
      var existingOrders = this._ordersByDirectedPair[key];
      if (existingOrders) {
        existingOrders[strategy.id.toString()] = order;
      } else {
        this._ordersByDirectedPair[key] =
          ((_a = {}), (_a[strategy.id.toString()] = order), _a);
      }
    }
  };
  ChainCache.prototype._removeStrategyOrders = function (strategy) {
    for (
      var _i = 0,
        _a = [
          [strategy.token0, strategy.token1],
          [strategy.token1, strategy.token0],
        ];
      _i < _a.length;
      _i++
    ) {
      var tokenOrder = _a[_i];
      var key = (0, utils_1.toDirectionKey)(tokenOrder[0], tokenOrder[1]);
      var existingOrders = this._ordersByDirectedPair[key];
      if (existingOrders) {
        delete existingOrders[strategy.id.toString()];
        // if there are no orders left for this pair, remove the pair from the map
        if (Object.keys(existingOrders).length === 0) {
          delete this._ordersByDirectedPair.key;
        }
      }
    }
  };
  ChainCache.prototype._addStrategy = function (strategy) {
    if (!this.hasCachedPair(strategy.token0, strategy.token1)) {
      throw new Error(
        'Pair '.concat(
          (0, utils_1.toPairKey)(strategy.token0, strategy.token1),
          ' is not cached, cannot add strategy',
        ),
      );
    }
    var key = (0, utils_1.toPairKey)(strategy.token0, strategy.token1);
    if (!!this._strategiesById[strategy.id.toString()]) {
      logger.debug(
        'Strategy '
          .concat(strategy.id, ' already cached, under the pair ')
          .concat(key, ' - skipping'),
      );
      return;
    }
    var strategies = this._strategiesByPair[key] || [];
    strategies.push(strategy);
    this._strategiesByPair[key] = strategies;
    this._strategiesById[strategy.id.toString()] = strategy;
    this._addStrategyOrders(strategy);
  };
  ChainCache.prototype._updateStrategy = function (strategy) {
    if (!this.hasCachedPair(strategy.token0, strategy.token1)) {
      throw new Error(
        'Pair '.concat(
          (0, utils_1.toPairKey)(strategy.token0, strategy.token1),
          ' is not cached, cannot update strategy',
        ),
      );
    }
    var key = (0, utils_1.toPairKey)(strategy.token0, strategy.token1);
    var strategies = (this._strategiesByPair[key] || []).filter(function (s) {
      return s.id !== strategy.id;
    });
    strategies.push(strategy);
    this._strategiesByPair[key] = strategies;
    this._strategiesById[strategy.id.toString()] = strategy;
    this._removeStrategyOrders(strategy);
    this._addStrategyOrders(strategy);
  };
  ChainCache.prototype._deleteStrategy = function (strategy) {
    if (!this.hasCachedPair(strategy.token0, strategy.token1)) {
      throw new Error(
        'Pair '.concat(
          (0, utils_1.toPairKey)(strategy.token0, strategy.token1),
          ' is not cached, cannot delete strategy',
        ),
      );
    }
    var key = (0, utils_1.toPairKey)(strategy.token0, strategy.token1);
    delete this._strategiesById[strategy.id.toString()];
    var strategies = (this._strategiesByPair[key] || []).filter(function (s) {
      return s.id !== strategy.id;
    });
    this._strategiesByPair[key] = strategies;
    this._removeStrategyOrders(strategy);
  };
  return ChainCache;
})(events_1.default);
exports.ChainCache = ChainCache;
