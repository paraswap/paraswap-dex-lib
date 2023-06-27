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
Object.defineProperty(exports, '__esModule', { value: true });
var utils_1 = require('./utils');
var logger_1 = require('../common/logger');
var logger = new logger_1.Logger('Reader.ts');
function toStrategy(res) {
  var id = res[0];
  var token0 = res[2][0];
  var token1 = res[2][1];
  var y0 = res[3][0][0];
  var z0 = res[3][0][1];
  var A0 = res[3][0][2];
  var B0 = res[3][0][3];
  var y1 = res[3][1][0];
  var z1 = res[3][1][1];
  var A1 = res[3][1][2];
  var B1 = res[3][1][3];
  return {
    id: id,
    token0: token0,
    token1: token1,
    order0: {
      y: y0,
      z: z0,
      A: A0,
      B: B0,
    },
    order1: {
      y: y1,
      z: z1,
      A: A1,
      B: B1,
    },
  };
}
/**
 * Class that provides methods to read data from contracts.
 */
var Reader = /** @class */ (function () {
  function Reader(contracts) {
    var _this = this;
    this.getDecimalsByAddress = function (address) {
      return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
          if ((0, utils_1.isETHAddress)(address)) {
            return [2 /*return*/, 18];
          }
          return [2 /*return*/, this._contracts.token(address).decimals()];
        });
      });
    };
    this._getFilteredStrategies = function (eventType, fromBlock, toBlock) {
      return __awaiter(_this, void 0, void 0, function () {
        var filter, logs, strategies;
        return __generator(this, function (_a) {
          switch (_a.label) {
            case 0:
              filter = this._contracts.carbonController.filters[eventType](
                null,
                null,
                null,
                null,
                null,
              );
              return [
                4 /*yield*/,
                this._contracts.carbonController.queryFilter(
                  filter,
                  fromBlock,
                  toBlock,
                ),
              ];
            case 1:
              logs = _a.sent();
              if (logs.length === 0) return [2 /*return*/, []];
              strategies = logs.map(function (log) {
                var logArgs = log.args;
                return {
                  id: logArgs.id,
                  token0: logArgs.token0,
                  token1: logArgs.token1,
                  order0: {
                    y: logArgs.order0.y,
                    z: logArgs.order0.z,
                    A: logArgs.order0.A,
                    B: logArgs.order0.B,
                  },
                  order1: {
                    y: logArgs.order1.y,
                    z: logArgs.order1.z,
                    A: logArgs.order1.A,
                    B: logArgs.order1.B,
                  },
                };
              });
              return [2 /*return*/, strategies];
          }
        });
      });
    };
    this.getLatestStrategyCreatedStrategies = function (fromBlock, toBlock) {
      return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
          return [
            2 /*return*/,
            this._getFilteredStrategies('StrategyCreated', fromBlock, toBlock),
          ];
        });
      });
    };
    this.getLatestStrategyUpdatedStrategies = function (fromBlock, toBlock) {
      return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
          return [
            2 /*return*/,
            this._getFilteredStrategies('StrategyUpdated', fromBlock, toBlock),
          ];
        });
      });
    };
    this.getLatestStrategyDeletedStrategies = function (fromBlock, toBlock) {
      return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
          return [
            2 /*return*/,
            this._getFilteredStrategies('StrategyDeleted', fromBlock, toBlock),
          ];
        });
      });
    };
    this.getLatestTokensTradedTrades = function (fromBlock, toBlock) {
      return __awaiter(_this, void 0, void 0, function () {
        var filter, logs, trades;
        return __generator(this, function (_a) {
          switch (_a.label) {
            case 0:
              filter = this._contracts.carbonController.filters.TokensTraded(
                null,
                null,
                null,
                null,
                null,
                null,
                null,
              );
              return [
                4 /*yield*/,
                this._contracts.carbonController.queryFilter(
                  filter,
                  fromBlock,
                  toBlock,
                ),
              ];
            case 1:
              logs = _a.sent();
              if (logs.length === 0) return [2 /*return*/, []];
              trades = logs.map(function (log) {
                var res = log.args;
                return {
                  sourceToken: res.sourceToken,
                  targetToken: res.targetToken,
                  sourceAmount: res.sourceAmount.toString(),
                  targetAmount: res.targetAmount.toString(),
                  trader: res.trader,
                  tradingFeeAmount: res.tradingFeeAmount.toString(),
                  byTargetAmount: res.byTargetAmount,
                };
              });
              return [2 /*return*/, trades];
          }
        });
      });
    };
    this.getBlockNumber = function () {
      return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
          return [2 /*return*/, this._contracts.provider.getBlockNumber()];
        });
      });
    };
    this.getBlock = function (blockNumber) {
      return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
          return [2 /*return*/, this._contracts.provider.getBlock(blockNumber)];
        });
      });
    };
    this._contracts = contracts;
  }
  Reader.prototype._multicall = function (calls, blockHeight) {
    return (0, utils_1.multicall)(
      calls,
      this._contracts.multicall,
      blockHeight,
    );
  };
  Reader.prototype.strategy = function (id) {
    return __awaiter(this, void 0, void 0, function () {
      var res;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            return [4 /*yield*/, this._contracts.carbonController.strategy(id)];
          case 1:
            res = _a.sent();
            return [2 /*return*/, toStrategy(res)];
        }
      });
    });
  };
  Reader.prototype.strategies = function (ids) {
    return __awaiter(this, void 0, void 0, function () {
      var results;
      var _this = this;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            return [
              4 /*yield*/,
              this._multicall(
                ids.map(function (id) {
                  return {
                    contractAddress: _this._contracts.carbonController.address,
                    interface: _this._contracts.carbonController.interface,
                    methodName: 'strategy',
                    methodParameters: [id],
                  };
                }),
              ),
            ];
          case 1:
            results = _a.sent();
            if (!results || results.length === 0) return [2 /*return*/, []];
            return [
              2 /*return*/,
              results.map(function (strategyRes) {
                var strategy = strategyRes[0];
                return toStrategy(strategy);
              }),
            ];
        }
      });
    });
  };
  Reader.prototype.pairs = function () {
    return this._contracts.carbonController.pairs();
  };
  Reader.prototype.strategiesByPair = function (token0, token1) {
    return __awaiter(this, void 0, void 0, function () {
      var res;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            return [
              4 /*yield*/,
              this._contracts.carbonController.strategiesByPair(
                token0,
                token1,
                0,
                0,
              ),
            ];
          case 1:
            res = _a.sent();
            return [
              2 /*return*/,
              res.map(function (r) {
                return toStrategy(r);
              }),
            ];
        }
      });
    });
  };
  Reader.prototype.tokensByOwner = function (owner) {
    return __awaiter(this, void 0, void 0, function () {
      return __generator(this, function (_a) {
        if (!owner) return [2 /*return*/, []];
        return [
          2 /*return*/,
          this._contracts.voucher.tokensByOwner(owner, 0, 0),
        ];
      });
    });
  };
  Reader.prototype.tradingFeePPM = function () {
    return this._contracts.carbonController.tradingFeePPM();
  };
  Reader.prototype.onTradingFeePPMUpdated = function (listener) {
    return this._contracts.carbonController.on(
      'TradingFeePPMUpdated',
      function (prevFeePPM, newFeePPM) {
        logger.debug('TradingFeePPMUpdated fired with', arguments);
        listener(prevFeePPM, newFeePPM);
      },
    );
  };
  return Reader;
})();
exports.default = Reader;
