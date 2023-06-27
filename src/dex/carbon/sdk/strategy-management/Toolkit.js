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
exports.Toolkit = exports.MarginalPriceOptions = void 0;
var numerics_1 = require('../utils/numerics');
var types_1 = require('../common/types');
var decimals_1 = require('../utils/decimals');
// Trade matcher utilities
var trade_matcher_1 = require('../trade-matcher');
// Stats functions
var stats_1 = require('./stats');
// Logger
var logger_1 = require('../common/logger');
var logger = new logger_1.Logger('index.ts');
// Strategy utils
var utils_1 = require('./utils');
// Encoder utility
var encoders_1 = require('../utils/encoders');
var utils_2 = require('../utils');
/**
 * Enum representing options for the marginal price parameter of the function.
 */
var MarginalPriceOptions;
(function (MarginalPriceOptions) {
  /** Indicates that the marginal price should be reset to its default value. */
  MarginalPriceOptions['reset'] = 'RESET';
  /** Indicates that the marginal price should be maintained at its current value. */
  MarginalPriceOptions['maintain'] = 'MAINTAIN';
})(
  (MarginalPriceOptions =
    exports.MarginalPriceOptions || (exports.MarginalPriceOptions = {})),
);
var Toolkit = /** @class */ (function () {
  /**
   * Constructs a new Toolkit instance.
   *
   * @param {ContractsApi} api - The ContractsApi instance.
   * @param {DecimalFetcher} [decimalFetcher] - Optional DecimalFetcher.
   */
  function Toolkit(api, cache, decimalFetcher) {
    var _this = this;
    logger.debug('SDK class constructor called with', arguments);
    this._api = api;
    this._cache = cache;
    // Create a fetcher that uses decimalFetcher if defined.
    // If decimalFetcher(address) returns undefined or if decimalFetcher
    // is undefined, use the default fetcher.
    var fetcher = function (address) {
      return __awaiter(_this, void 0, void 0, function () {
        var decimals, _a;
        var _b;
        return __generator(this, function (_c) {
          switch (_c.label) {
            case 0:
              return [
                4 /*yield*/,
                decimalFetcher === null || decimalFetcher === void 0
                  ? void 0
                  : decimalFetcher(address),
              ];
            case 1:
              if (!((_b = _c.sent()) !== null && _b !== void 0))
                return [3 /*break*/, 2];
              _a = _b;
              return [3 /*break*/, 4];
            case 2:
              return [
                4 /*yield*/,
                this._api.reader.getDecimalsByAddress(address),
              ];
            case 3:
              _a = _c.sent();
              _c.label = 4;
            case 4:
              decimals = _a;
              return [2 /*return*/, decimals];
          }
        });
      });
    };
    this._decimals = new decimals_1.Decimals(fetcher);
  }
  Toolkit.getMatchActions = function (
    amountWei,
    tradeByTargetAmount,
    ordersMap,
    matchType,
    filter,
  ) {
    var _a, _b;
    if (matchType === void 0) {
      matchType = types_1.MatchType.Fast;
    }
    var orders = (0, utils_2.ordersMapStrToBN)(ordersMap);
    var result;
    if (tradeByTargetAmount) {
      result = (0, trade_matcher_1.matchByTargetAmount)(
        numerics_1.BigNumber.from(amountWei),
        orders,
        [matchType],
        filter,
      );
    } else {
      result = (0, trade_matcher_1.matchBySourceAmount)(
        numerics_1.BigNumber.from(amountWei),
        orders,
        [matchType],
        filter,
      );
    }
    return (_b =
      (_a = result[matchType]) === null || _a === void 0
        ? void 0
        : _a.map(utils_2.matchActionBNToStr)) !== null && _b !== void 0
      ? _b
      : [];
  };
  /**
   * Returns whether a pair has liquidity
   *
   * @param {string} sourceToken - address of the token the trade sells.
   * @param {string} targetToken - address of the token the trade buys.
   *
   * @returns {Boolean} true or false.
   * @throws {Error} If `startDataSync` has not been called.
   * @throws {Error} If no orders have been found.
   */
  Toolkit.prototype.hasLiquidityByPair = function (sourceToken, targetToken) {
    return __awaiter(this, arguments, void 0, function () {
      var orders;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            logger.debug('hasLiquidityByPair called', arguments);
            return [
              4 /*yield*/,
              this._cache.getOrdersByPair(sourceToken, targetToken),
            ];
          case 1:
            orders = _a.sent();
            logger.debug('hasLiquidityByPair info:', {
              orders: orders,
            });
            return [2 /*return*/, Object.keys(orders).length > 0];
        }
      });
    });
  };
  /**
   * Returns liquidity for a given pair.
   *
   * @param {string} sourceToken - address of the token the trade sells.
   * @param {string} targetToken - address of the token the trade buys.
   *
   * @returns {Promise<String>} liquidity value as string
   * @throws {Error} If `startDataSync` has not been called.
   */
  Toolkit.prototype.getLiquidityByPair = function (sourceToken, targetToken) {
    return __awaiter(this, arguments, void 0, function () {
      var orders, liquidityWei, decimals, liquidity;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            logger.debug('getLiquidityByPair called', arguments);
            return [
              4 /*yield*/,
              this._cache.getOrdersByPair(sourceToken, targetToken),
            ];
          case 1:
            orders = _a.sent();
            liquidityWei = Object.values(orders).reduce(function (acc, _a) {
              var y = _a.y;
              return acc.add(y);
            }, numerics_1.BigNumber.from(0));
            return [4 /*yield*/, this._decimals.fetchDecimals(targetToken)];
          case 2:
            decimals = _a.sent();
            liquidity = (0, numerics_1.formatUnits)(liquidityWei, decimals);
            logger.debug('getLiquidityByPair info:', {
              orders: orders,
              liquidityWei: liquidityWei,
              targetToken: targetToken,
              decimals: decimals,
              liquidity: liquidity,
            });
            return [2 /*return*/, liquidity];
        }
      });
    });
  };
  /**
   * Returns the maximum source amount for a given pair.
   * This is the sum of all source amounts in the orderbook.
   * This number represents the maximum amount that can be traded by source.
   *
   * @param {string} sourceToken - Address of the token the trade sells.
   * @param {string} targetToken - Address of the token the trade buys.
   *
   * @returns {Promise<string>} Maximum source amount as a string.
   * @throws {Error} If `startDataSync` has not been called.
   */
  Toolkit.prototype.getMaxSourceAmountByPair = function (
    sourceToken,
    targetToken,
  ) {
    return __awaiter(this, arguments, void 0, function () {
      var orders, maxSourceAmountWei, decimals, maxSourceAmount;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            logger.debug('getMaxSourceAmountByPair called', arguments);
            return [
              4 /*yield*/,
              this._cache.getOrdersByPair(sourceToken, targetToken),
            ];
          case 1:
            orders = _a.sent();
            maxSourceAmountWei = Object.values(orders).reduce(function (
              acc,
              order,
            ) {
              return acc.add(
                (0, trade_matcher_1.getEncodedTradeSourceAmount)(
                  order.y,
                  order,
                ),
              );
            },
            numerics_1.BigNumber.from(0));
            return [4 /*yield*/, this._decimals.fetchDecimals(sourceToken)];
          case 2:
            decimals = _a.sent();
            maxSourceAmount = (0, numerics_1.formatUnits)(
              maxSourceAmountWei,
              decimals,
            );
            logger.debug('getMaxSourceAmountByPair info:', {
              orders: orders,
              maxSourceAmountWei: maxSourceAmountWei,
              sourceToken: sourceToken,
              decimals: decimals,
              maxSourceAmount: maxSourceAmount,
            });
            return [2 /*return*/, maxSourceAmount];
        }
      });
    });
  };
  /**
   * Gets the strategies that are owned by the user.
   * It does so by reading the voucher token and
   * figuring out strategy IDs from them.
   * It is possible to pass a synced cache and in that case
   * the strategies will be read from the cache first.
   * @param {string} user - The user who owns the strategies.
   *
   * @returns {Promise<Strategy[]>} An array of owned strategies.
   *
   */
  Toolkit.prototype.getUserStrategies = function (user) {
    return __awaiter(this, arguments, void 0, function () {
      var ids,
        encodedStrategies,
        uncachedIds,
        uncachedStrategies,
        decodedStrategies,
        strategies;
      var _this = this;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            logger.debug('getUserStrategies called', arguments);
            return [4 /*yield*/, this._api.reader.tokensByOwner(user)];
          case 1:
            ids = _a.sent();
            encodedStrategies = [];
            uncachedIds = ids;
            if (this._cache) {
              uncachedIds = ids.reduce(function (acc, id) {
                var strategy = _this._cache.getStrategyById(id);
                if (!strategy) {
                  acc.push(id);
                } else {
                  encodedStrategies.push(strategy);
                }
                return acc;
              }, []);
            }
            if (!(uncachedIds.length > 0)) return [3 /*break*/, 3];
            return [4 /*yield*/, this._api.reader.strategies(uncachedIds)];
          case 2:
            uncachedStrategies = _a.sent();
            encodedStrategies = __spreadArray(
              __spreadArray([], encodedStrategies, true),
              uncachedStrategies,
              true,
            );
            _a.label = 3;
          case 3:
            decodedStrategies = encodedStrategies.map(utils_1.decodeStrategy);
            return [
              4 /*yield*/,
              Promise.all(
                decodedStrategies.map(function (strategy) {
                  return __awaiter(_this, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                      switch (_a.label) {
                        case 0:
                          return [
                            4 /*yield*/,
                            (0, utils_1.parseStrategy)(
                              strategy,
                              this._decimals,
                            ),
                          ];
                        case 1:
                          return [2 /*return*/, _a.sent()];
                      }
                    });
                  });
                }),
              ),
            ];
          case 4:
            strategies = _a.sent();
            logger.debug('getUserStrategies info:', {
              ids: ids,
              encodedStrategies: encodedStrategies,
              decodedStrategies: decodedStrategies,
              strategies: strategies,
            });
            return [2 /*return*/, strategies];
        }
      });
    });
  };
  /**
   * Returns the data needed to process a trade.
   * `getMatchParams` returns the data for a given source and target token pair.
   * You can use the result to call `matchBySourceAmount` or `matchByTargetAmount`,
   * then get the actions and pass them to `getTradeDataFromActions`.
   *
   * @param {string} sourceToken - Address of the source token.
   * @param {string} targetToken - Address of the target token.
   * @param {string} amount - The amount of tokens to trade.
   * @param {boolean} tradeByTargetAmount - Whether to trade by target amount (`true`) or source amount (`false`).
   *
   * @returns {Promise<Object>} An object containing the necessary data to process a trade.
   * @property {OrdersMap} orders - The orders mapped by their IDs.
   * @property {string} amountWei - The amount in wei to trade.
   * @property {number} sourceDecimals - The number of decimals for the source token.
   * @property {number} targetDecimals - The number of decimals for the target token.
   */
  Toolkit.prototype.getMatchParams = function (
    sourceToken,
    targetToken,
    amount,
    tradeByTargetAmount,
  ) {
    return __awaiter(this, arguments, void 0, function () {
      var decimals, sourceDecimals, targetDecimals, orders, amountWei;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            logger.debug('getMatchParams called', arguments);
            decimals = this._decimals;
            return [4 /*yield*/, decimals.fetchDecimals(sourceToken)];
          case 1:
            sourceDecimals = _a.sent();
            return [4 /*yield*/, decimals.fetchDecimals(targetToken)];
          case 2:
            targetDecimals = _a.sent();
            return [
              4 /*yield*/,
              this._cache.getOrdersByPair(sourceToken, targetToken),
            ];
          case 3:
            orders = _a.sent();
            amountWei = (0, numerics_1.parseUnits)(
              amount,
              tradeByTargetAmount ? targetDecimals : sourceDecimals,
            );
            return [
              2 /*return*/,
              {
                orders: (0, utils_2.ordersMapBNToStr)(orders),
                amountWei: amountWei.toString(),
                sourceDecimals: sourceDecimals,
                targetDecimals: targetDecimals,
              },
            ];
        }
      });
    });
  };
  /**
   * Returns the off-chain match algorithm results of orders to fulfill to complete the trade.
   * Each trade action is identified by the ID of the strategy that the trade order belongs to
   * and the input amount to place for this order.
   *
   * The `getTradeData` method will match the specified `amount` of source tokens or target tokens
   * with available orders from the blockchain, depending on the value of `tradeByTargetAmount`.
   * It uses the provided `filter` function to filter the available orders. The resulting trade
   * actions will be returned in an object, along with the unsigned transaction that can be used
   * to execute the trade.
   *
   * It is up to the user to sign and send the transaction.
   *
   * @param {string} sourceToken - The source token for the trade.
   * @param {string} targetToken - The target token for the trade.
   * @param {string} amount - The amount of source tokens or target tokens to trade, depending on the value of `tradeByTargetAmount`.
   * @param {boolean} tradeByTargetAmount - Whether to trade by target amount (`true`) or source amount (`false`).
   * @param {MatchType} [matchType] - The type of match to perform. Defaults to `MatchType.Fast`.
   * @param {(rate: Rate) => boolean} [filter] - Optional function to filter the available orders.
   *
   * @returns {Promise<Object>} An object containing the trade actions and other relevant data.
   * @property {TradeAction[]} tradeActions - An array of trade actions in wei.
   * @property {Action[]} actionsTokenRes - An array of trade actions in the proper token resolution.
   * @property {string} totalSourceAmount - The total input amount in token resolution.
   * @property {string} totalTargetAmount - The total output amount in token resolution.
   * @property {string} effectiveRate - The effective rate between totalInput and totalOutput
   * @property {MatchAction[]} actionsWei - An array of trade actions in wei.
   * @throws {Error} If `startDataSync` has not been called.
   */
  Toolkit.prototype.getTradeData = function (
    sourceToken,
    targetToken,
    amount,
    tradeByTargetAmount,
    matchType,
    filter,
  ) {
    if (matchType === void 0) {
      matchType = types_1.MatchType.Fast;
    }
    return __awaiter(this, arguments, void 0, function () {
      var _a, orders, amountWei, actionsWei, res;
      return __generator(this, function (_b) {
        switch (_b.label) {
          case 0:
            logger.debug('getTradeData called', arguments);
            return [
              4 /*yield*/,
              this.getMatchParams(
                sourceToken,
                targetToken,
                amount,
                tradeByTargetAmount,
              ),
            ];
          case 1:
            (_a = _b.sent()), (orders = _a.orders), (amountWei = _a.amountWei);
            actionsWei = Toolkit.getMatchActions(
              amountWei,
              tradeByTargetAmount,
              orders,
              matchType,
              filter,
            );
            return [
              4 /*yield*/,
              this.getTradeDataFromActions(
                sourceToken,
                targetToken,
                tradeByTargetAmount,
                actionsWei,
              ),
            ];
          case 2:
            res = _b.sent();
            logger.debug('getTradeData info:', {
              orders: orders,
              amount: amount,
              amountWei: amountWei,
              res: res,
            });
            return [2 /*return*/, res];
        }
      });
    });
  };
  Toolkit.prototype.getTradeDataFromActions = function (
    sourceToken,
    targetToken,
    tradeByTargetAmount,
    actionsWei,
  ) {
    return __awaiter(this, arguments, void 0, function () {
      var feePPM,
        decimals,
        sourceDecimals,
        targetDecimals,
        tradeActions,
        actionsTokenRes,
        totalOutput,
        totalInput,
        totalSourceAmount,
        totalTargetAmount,
        res,
        effectiveRate;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            logger.debug('getTradeDataFromActions called', arguments);
            feePPM = this._cache.tradingFeePPM;
            // intentional == instead of ===
            if (feePPM == undefined)
              throw new Error('tradingFeePPM is undefined');
            decimals = this._decimals;
            return [4 /*yield*/, decimals.fetchDecimals(sourceToken)];
          case 1:
            sourceDecimals = _a.sent();
            return [4 /*yield*/, decimals.fetchDecimals(targetToken)];
          case 2:
            targetDecimals = _a.sent();
            tradeActions = [];
            actionsTokenRes = [];
            totalOutput = numerics_1.BigNumber.from(0);
            totalInput = numerics_1.BigNumber.from(0);
            actionsWei.forEach(function (action) {
              tradeActions.push({
                strategyId: action.id,
                amount: action.input,
              });
              if (tradeByTargetAmount) {
                actionsTokenRes.push({
                  id: action.id,
                  sourceAmount: (0, numerics_1.formatUnits)(
                    (0, utils_1.addFee)(action.output, feePPM)
                      .floor()
                      .toFixed(0),
                    sourceDecimals,
                  ),
                  targetAmount: (0, numerics_1.formatUnits)(
                    action.input,
                    targetDecimals,
                  ),
                });
              } else {
                actionsTokenRes.push({
                  id: action.id,
                  sourceAmount: (0, numerics_1.formatUnits)(
                    action.input,
                    sourceDecimals,
                  ),
                  targetAmount: (0, numerics_1.formatUnits)(
                    (0, utils_1.subtractFee)(action.output, feePPM)
                      .floor()
                      .toFixed(0),
                    targetDecimals,
                  ),
                });
              }
              totalInput = totalInput.add(action.input);
              totalOutput = totalOutput.add(action.output);
            });
            if (tradeByTargetAmount) {
              totalSourceAmount = (0, utils_1.addFee)(totalOutput, feePPM)
                .floor()
                .toFixed(0);
              totalTargetAmount = totalInput.toString();
            } else {
              totalSourceAmount = totalInput.toString();
              totalTargetAmount = (0, utils_1.subtractFee)(totalOutput, feePPM)
                .floor()
                .toFixed(0);
            }
            if (
              new numerics_1.Decimal(totalSourceAmount).isZero() ||
              new numerics_1.Decimal(totalTargetAmount).isZero()
            ) {
              res = {
                tradeActions: tradeActions,
                actionsTokenRes: actionsTokenRes,
                totalSourceAmount: '0',
                totalTargetAmount: '0',
                effectiveRate: '0',
                actionsWei: actionsWei,
              };
            } else {
              effectiveRate = new numerics_1.Decimal(totalTargetAmount)
                .div(totalSourceAmount)
                .times((0, numerics_1.tenPow)(sourceDecimals, targetDecimals))
                .toString();
              res = {
                tradeActions: tradeActions,
                actionsTokenRes: actionsTokenRes,
                totalSourceAmount: (0, numerics_1.formatUnits)(
                  totalSourceAmount,
                  sourceDecimals,
                ),
                totalTargetAmount: (0, numerics_1.formatUnits)(
                  totalTargetAmount,
                  targetDecimals,
                ),
                effectiveRate: effectiveRate,
                actionsWei: actionsWei,
              };
            }
            logger.debug('getTradeDataFromActions info:', {
              sourceDecimals: sourceDecimals,
              targetDecimals: targetDecimals,
              actionsWei: actionsWei,
              totalInput: totalInput,
              totalOutput: totalOutput,
              tradingFeePPM: feePPM,
              res: res,
            });
            return [2 /*return*/, res];
        }
      });
    });
  };
  /**
   * Creates an unsigned transaction to fulfill a trade using an array of trade actions.
   * Each trade action is identified by the ID of the strategy that the trade order belongs to
   * and the input amount to place for this order.
   *
   * It is up to the user to sign and send the transaction.
   *
   * @param {string} sourceToken - The source token for the trade.
   * @param {string} targetToken - The target token for the trade.
   * @param {TradeAction[]} tradeActions - An array of trade actions in wei - as received from `trade`.
   * @param {string} deadline - Deadline for the trade
   * @param {string} maxInput - Maximum input for the trade
   * @param {Overrides} [overrides] - Optional overrides for the transaction.
   * @returns {Promise<PopulatedTransaction>}  A promise that resolves to the unsigned trade transaction.
   *
   * @example
   * // calling trade
   * const tradeTx = sdk.composeTradeTransaction(
   *   '0xE0B7927c4aF23765Cb51314A0E0521A9645F0E2A',
   *   '0x6B175474E89094C44Da98b954EedeAC495271d0F',
   *   false,
   *   []
   * );
   *
   * // Performing the trade by signing and sending the transaction:
   *
   * // Import the ethers.js library and the relevant wallet provider
   * const ethers = require('ethers');
   * const provider = new ethers.providers.Web3Provider(web3.currentProvider);
   *
   * // Load the private key for the wallet that will sign and send the transaction
   * const privateKey = '0x...';
   * const wallet = new ethers.Wallet(privateKey, provider);
   *
   * // Sign and send the transaction
   * const signedTradeTx = await wallet.sign(tradeTx);
   * const txReceipt = await provider.sendTransaction(signedTradeTx);
   * console.log(txReceipt);
   * // {
   * //   blockHash: '0x...',
   * //   blockNumber: 12345,
   * //   ...
   * // }
   */
  Toolkit.prototype.composeTradeByTargetTransaction = function (
    sourceToken,
    targetToken,
    tradeActions,
    deadline,
    maxInput,
    overrides,
  ) {
    return __awaiter(this, arguments, void 0, function () {
      var sourceDecimals;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            logger.debug('composeTradeByTargetTransaction called', arguments);
            return [4 /*yield*/, this._decimals.fetchDecimals(sourceToken)];
          case 1:
            sourceDecimals = _a.sent();
            return [
              2 /*return*/,
              this._api.composer.tradeByTargetAmount(
                sourceToken,
                targetToken,
                tradeActions.map(utils_2.tradeActionStrToBN),
                deadline,
                (0, numerics_1.parseUnits)(maxInput, sourceDecimals),
                overrides,
              ),
            ];
        }
      });
    });
  };
  /**
   * Creates an unsigned transaction to fulfill a trade using an array of trade actions.
   * Each trade action is identified by the ID of the strategy that the trade order belongs to
   * and the input amount to place for this order.
   *
   * It is up to the user to sign and send the transaction.
   *
   * @param {string} sourceToken - The source token for the trade.
   * @param {string} targetToken - The target token for the trade.
   * @param {TradeAction[]} tradeActions - An array of trade actions in wei - as received from `trade`.
   * @param {string} deadline - Deadline for the trade
   * @param {string} minReturn - Minimum return for the trade
   * @param {Overrides} [overrides] - Optional overrides for the transaction.
   * @returns {Promise<PopulatedTransaction>}  A promise that resolves to the unsigned trade transaction.
   *
   * @example
   * // calling trade
   * const tradeTx = sdk.composeTradeTransaction(
   *   '0xE0B7927c4aF23765Cb51314A0E0521A9645F0E2A',
   *   '0x6B175474E89094C44Da98b954EedeAC495271d0F',
   *   false,
   *   []
   * );
   *
   * // Performing the trade by signing and sending the transaction:
   *
   * // Import the ethers.js library and the relevant wallet provider
   * const ethers = require('ethers');
   * const provider = new ethers.providers.Web3Provider(web3.currentProvider);
   *
   * // Load the private key for the wallet that will sign and send the transaction
   * const privateKey = '0x...';
   * const wallet = new ethers.Wallet(privateKey, provider);
   *
   * // Sign and send the transaction
   * const signedTradeTx = await wallet.sign(tradeTx);
   * const txReceipt = await provider.sendTransaction(signedTradeTx);
   * console.log(txReceipt);
   * // {
   * //   blockHash: '0x...',
   * //   blockNumber: 12345,
   * //   ...
   * // }
   */
  Toolkit.prototype.composeTradeBySourceTransaction = function (
    sourceToken,
    targetToken,
    tradeActions,
    deadline,
    minReturn,
    overrides,
  ) {
    return __awaiter(this, arguments, void 0, function () {
      var targetDecimals;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            logger.debug('composeTradeBySourceTransaction called', arguments);
            return [4 /*yield*/, this._decimals.fetchDecimals(targetToken)];
          case 1:
            targetDecimals = _a.sent();
            return [
              2 /*return*/,
              this._api.composer.tradeBySourceAmount(
                sourceToken,
                targetToken,
                tradeActions.map(utils_2.tradeActionStrToBN),
                deadline,
                (0, numerics_1.parseUnits)(minReturn, targetDecimals),
                overrides,
              ),
            ];
        }
      });
    });
  };
  /**
   * Creates an unsigned transaction to create a strategy for buying and selling tokens of `baseToken` for price in `quoteToken` per 1 `baseToken`.
   *
   * The `createBuySellStrategy` method creates a strategy object based on the specified parameters, encodes it according to the
   * format used by the smart contracts, and returns an unsigned transaction that can be used to create the strategy on the
   * blockchain.
   *
   * It is up to the user to sign and send the transaction.
   *
   * @param {string} baseToken - The address of the base token for the strategy.
   * @param {string} quoteToken - The address of the quote token for the strategy.
   * @param {string} buyPriceLow - The minimum buy price for the strategy, in in `quoteToken` per 1 `baseToken`, as a string.
   * @param {string} buyPriceHigh - The maximum buy price for the strategy, in `quoteToken` per 1 `baseToken`, as a string.
   * @param {string} buyBudget - The maximum budget for buying tokens in the strategy, in `quoteToken`, as a string.
   * @param {string} sellPriceLow - The minimum sell price for the strategy, in `quoteToken` per 1 `baseToken`, as a string.
   * @param {string} sellPriceHigh - The maximum sell price for the strategy, in `quoteToken` per 1 `baseToken`, as a string.
   * @param {string} sellBudget - The maximum budget for selling tokens in the strategy, in `baseToken`, as a string.
   * @param {Overrides} [overrides] - Optional overrides for the transaction, such as gas price or nonce.
   * @returns {Promise<PopulatedTransaction>} A promise that resolves to the unsigned transaction that can be used to create the strategy.
   * *
   * @example
   * // Import the ethers.js library and the relevant wallet provider
   * const ethers = require('ethers');
   * const provider = new ethers.providers.Web3Provider(web3.currentProvider);
   *
   * // Load the private key for the wallet that will sign and send the transaction
   * const privateKey = '0x...';
   * const wallet = new ethers.Wallet(privateKey, provider);
   *
   * // Call the createBuySellStrategy method to create an unsigned transaction
   * const createStrategyTx = sdk.createBuySellStrategy(
   *   '0xE0B7927c4aF23765Cb51314A0E0521A9645F0E2A',
   *   '0x6B175474E89094C44Da98b954EedeAC495271d0F',
   *   '0.1',
   *   '0.2',
   *   '1',
   *   '0.5',
   *   '0.6',
   *   '2'
   * );
   *
   * // Sign and send the transaction
   * const signedCreateStrategyTx = await wallet.sign(createStrategyTx);
   * const txReceipt = await provider.sendTransaction(signedCreateStrategyTx);
   */
  Toolkit.prototype.createBuySellStrategy = function (
    baseToken,
    quoteToken,
    buyPriceLow,
    buyPriceHigh,
    buyBudget,
    sellPriceLow,
    sellPriceHigh,
    sellBudget,
    overrides,
  ) {
    return __awaiter(this, arguments, void 0, function () {
      var decimals, baseDecimals, quoteDecimals, strategy, encStrategy;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            logger.debug('createBuySellStrategy called', arguments);
            decimals = this._decimals;
            return [4 /*yield*/, decimals.fetchDecimals(baseToken)];
          case 1:
            baseDecimals = _a.sent();
            return [4 /*yield*/, decimals.fetchDecimals(quoteToken)];
          case 2:
            quoteDecimals = _a.sent();
            strategy = (0, utils_1.buildStrategyObject)(
              baseToken,
              quoteToken,
              baseDecimals,
              quoteDecimals,
              buyPriceLow,
              buyPriceHigh,
              buyBudget,
              sellPriceLow,
              sellPriceHigh,
              sellBudget,
            );
            encStrategy = (0, utils_1.encodeStrategy)(strategy);
            logger.debug('createBuySellStrategy info:', {
              strategy: strategy,
              encStrategy: encStrategy,
            });
            return [
              2 /*return*/,
              this._api.composer.createStrategy(
                encStrategy.token0,
                encStrategy.token1,
                encStrategy.order0,
                encStrategy.order1,
                overrides,
              ),
            ];
        }
      });
    });
  };
  /**
   *
   * @param strategyId
   * @param encoded
   * @param param2
   * @param {MarginalPriceOptions | string} marginalPrice - The marginal price parameter.
   * Can either be a value from the `MarginalPriceOptions` enum, or a "BigNumberish" string value for advanced users -
   * who wish to set the marginal price themselves.
   * @param overrides
   * @returns
   */
  Toolkit.prototype.updateStrategy = function (
    strategyId,
    encoded,
    _a,
    buyMarginalPrice,
    sellMarginalPrice,
    overrides,
  ) {
    var buyPriceLow = _a.buyPriceLow,
      buyPriceHigh = _a.buyPriceHigh,
      buyBudget = _a.buyBudget,
      sellPriceLow = _a.sellPriceLow,
      sellPriceHigh = _a.sellPriceHigh,
      sellBudget = _a.sellBudget;
    return __awaiter(this, arguments, void 0, function () {
      var decodedOriginal,
        originalStrategy,
        decimals,
        baseDecimals,
        quoteDecimals,
        newStrategy,
        newEncodedStrategy,
        encodedBN;
      return __generator(this, function (_b) {
        switch (_b.label) {
          case 0:
            logger.debug('updateStrategy called', arguments);
            decodedOriginal = (0, utils_1.decodeStrategy)(
              (0, utils_2.encodedStrategyStrToBN)(encoded),
            );
            return [
              4 /*yield*/,
              (0, utils_1.parseStrategy)(decodedOriginal, this._decimals),
            ];
          case 1:
            originalStrategy = _b.sent();
            decimals = this._decimals;
            return [
              4 /*yield*/,
              decimals.fetchDecimals(originalStrategy.baseToken),
            ];
          case 2:
            baseDecimals = _b.sent();
            return [
              4 /*yield*/,
              decimals.fetchDecimals(originalStrategy.quoteToken),
            ];
          case 3:
            quoteDecimals = _b.sent();
            newStrategy = (0, utils_1.buildStrategyObject)(
              originalStrategy.baseToken,
              originalStrategy.quoteToken,
              baseDecimals,
              quoteDecimals,
              buyPriceLow !== null && buyPriceLow !== void 0
                ? buyPriceLow
                : originalStrategy.buyPriceLow,
              buyPriceHigh !== null && buyPriceHigh !== void 0
                ? buyPriceHigh
                : originalStrategy.buyPriceHigh,
              buyBudget !== null && buyBudget !== void 0
                ? buyBudget
                : originalStrategy.buyBudget,
              sellPriceLow !== null && sellPriceLow !== void 0
                ? sellPriceLow
                : originalStrategy.sellPriceLow,
              sellPriceHigh !== null && sellPriceHigh !== void 0
                ? sellPriceHigh
                : originalStrategy.sellPriceHigh,
              sellBudget !== null && sellBudget !== void 0
                ? sellBudget
                : originalStrategy.sellBudget,
            );
            newEncodedStrategy = (0, utils_1.encodeStrategy)(newStrategy);
            encodedBN = (0, utils_2.encodedStrategyStrToBN)(encoded);
            if (buyBudget === undefined) {
              newEncodedStrategy.order1.y = encodedBN.order1.y;
            }
            if (sellBudget === undefined) {
              newEncodedStrategy.order0.y = encodedBN.order0.y;
            }
            if (buyPriceLow === undefined && buyPriceHigh === undefined) {
              newEncodedStrategy.order1.A = encodedBN.order1.A;
              newEncodedStrategy.order1.B = encodedBN.order1.B;
            }
            if (sellPriceLow === undefined && sellPriceHigh === undefined) {
              newEncodedStrategy.order0.A = encodedBN.order0.A;
              newEncodedStrategy.order0.B = encodedBN.order0.B;
            }
            if (buyBudget !== undefined) {
              if (
                buyMarginalPrice === undefined ||
                buyMarginalPrice === MarginalPriceOptions.reset ||
                encodedBN.order1.y.isZero()
              ) {
                newEncodedStrategy.order1.z = newEncodedStrategy.order1.y;
              } else if (buyMarginalPrice === MarginalPriceOptions.maintain) {
                // maintain the current ratio of y/z
                newEncodedStrategy.order1.z = (0, numerics_1.mulDiv)(
                  encodedBN.order1.z,
                  newEncodedStrategy.order1.y,
                  encodedBN.order1.y,
                );
              }
            }
            if (sellBudget !== undefined) {
              if (
                sellMarginalPrice === undefined ||
                sellMarginalPrice === MarginalPriceOptions.reset ||
                encodedBN.order0.y.isZero()
              ) {
                newEncodedStrategy.order0.z = newEncodedStrategy.order0.y;
              } else if (sellMarginalPrice === MarginalPriceOptions.maintain) {
                // maintain the current ratio of y/z
                newEncodedStrategy.order0.z = (0, numerics_1.mulDiv)(
                  encodedBN.order0.z,
                  newEncodedStrategy.order0.y,
                  encodedBN.order0.y,
                );
              }
            }
            if (buyPriceLow !== undefined || buyPriceHigh !== undefined) {
              newEncodedStrategy.order1.z = newEncodedStrategy.order1.y;
            }
            if (sellPriceLow !== undefined || sellPriceHigh !== undefined) {
              newEncodedStrategy.order0.z = newEncodedStrategy.order0.y;
            }
            if (
              buyMarginalPrice !== undefined &&
              buyMarginalPrice !== MarginalPriceOptions.reset &&
              buyMarginalPrice !== MarginalPriceOptions.maintain
            ) {
              // TODO: set newEncodedStrategy.order1.z according to the given marginal price
              throw new Error(
                'Support for custom marginal price is not implemented yet',
              );
            }
            if (
              sellMarginalPrice !== undefined &&
              sellMarginalPrice !== MarginalPriceOptions.reset &&
              sellMarginalPrice !== MarginalPriceOptions.maintain
            ) {
              // TODO: set newEncodedStrategy.order0.z according to the given marginal price
              throw new Error(
                'Support for custom marginal price is not implemented yet',
              );
            }
            logger.debug('updateStrategy info:', {
              baseDecimals: baseDecimals,
              quoteDecimals: quoteDecimals,
              decodedOriginal: decodedOriginal,
              originalStrategy: originalStrategy,
              newStrategy: newStrategy,
              newEncodedStrategy: newEncodedStrategy,
            });
            return [
              2 /*return*/,
              this._api.composer.updateStrategy(
                numerics_1.BigNumber.from(strategyId),
                newEncodedStrategy.token0,
                newEncodedStrategy.token1,
                [encodedBN.order0, encodedBN.order1],
                [newEncodedStrategy.order0, newEncodedStrategy.order1],
                overrides,
              ),
            ];
        }
      });
    });
  };
  Toolkit.prototype.deleteStrategy = function (strategyId) {
    return __awaiter(this, arguments, void 0, function () {
      return __generator(this, function (_a) {
        logger.debug('deleteStrategy called', arguments);
        return [
          2 /*return*/,
          this._api.composer.deleteStrategy(
            numerics_1.BigNumber.from(strategyId),
          ),
        ];
      });
    });
  };
  /**
   * Returns liquidity for a given rate.
   *
   * @param {string} sourceToken - address of the token the trade sells.
   * @param {string} targetToken - address of the token the trade buys.
   * @param {string[]} rates - the rates for which to find liquidity depth.
   *
   * @returns {Promise<String[]>} liquidity value as string
   * @throws {Error} If `startDataSync` has not been called.
   */
  Toolkit.prototype.getRateLiquidityDepthsByPair = function (
    sourceToken,
    targetToken,
    rates,
  ) {
    return __awaiter(this, arguments, void 0, function () {
      var orders,
        _a,
        _b,
        decimals,
        sourceDecimals,
        targetDecimals,
        parsedRates,
        depthsWei,
        depthsInTargetDecimals;
      return __generator(this, function (_c) {
        switch (_c.label) {
          case 0:
            logger.debug('getRateLiquidityDepthByPair called', arguments);
            _b = (_a = Object).values;
            return [
              4 /*yield*/,
              this._cache.getOrdersByPair(sourceToken, targetToken),
            ];
          case 1:
            orders = _b.apply(_a, [_c.sent()]).map(encoders_1.decodeOrder);
            decimals = this._decimals;
            return [4 /*yield*/, decimals.fetchDecimals(sourceToken)];
          case 2:
            sourceDecimals = _c.sent();
            return [4 /*yield*/, decimals.fetchDecimals(targetToken)];
          case 3:
            targetDecimals = _c.sent();
            parsedRates = rates.map(function (rate) {
              return new numerics_1.Decimal(
                (0, utils_1.normalizeRate)(
                  rate,
                  targetDecimals,
                  sourceDecimals,
                ),
              );
            });
            depthsWei = (0, stats_1.getDepths)(orders, parsedRates).map(
              function (rate) {
                return rate.floor().toFixed(0);
              },
            );
            depthsInTargetDecimals = depthsWei.map(function (depthWei) {
              return (0, numerics_1.formatUnits)(depthWei, targetDecimals);
            });
            logger.debug('getRateLiquidityDepthByPair info:', {
              orders: orders,
              depthsWei: depthsWei,
              targetDecimals: targetDecimals,
              depthsInTargetDecimals: depthsInTargetDecimals,
            });
            return [2 /*return*/, depthsInTargetDecimals];
        }
      });
    });
  };
  Toolkit.prototype.getMinRateByPair = function (sourceToken, targetToken) {
    return __awaiter(this, arguments, void 0, function () {
      var orders,
        _a,
        _b,
        minRate,
        decimals,
        sourceDecimals,
        targetDecimals,
        normalizedRate;
      return __generator(this, function (_c) {
        switch (_c.label) {
          case 0:
            logger.debug('getMinRateByPair called', arguments);
            _b = (_a = Object).values;
            return [
              4 /*yield*/,
              this._cache.getOrdersByPair(sourceToken, targetToken),
            ];
          case 1:
            orders = _b.apply(_a, [_c.sent()]).map(encoders_1.decodeOrder);
            minRate = (0, stats_1.getMinRate)(orders).toString();
            decimals = this._decimals;
            return [4 /*yield*/, decimals.fetchDecimals(sourceToken)];
          case 2:
            sourceDecimals = _c.sent();
            return [4 /*yield*/, decimals.fetchDecimals(targetToken)];
          case 3:
            targetDecimals = _c.sent();
            normalizedRate = (0, utils_1.normalizeRate)(
              minRate,
              sourceDecimals,
              targetDecimals,
            );
            logger.debug('getMinRateByPair info:', {
              orders: orders,
              minRate: minRate,
              sourceDecimals: sourceDecimals,
              targetDecimals: targetDecimals,
              normalizedRate: normalizedRate,
            });
            return [2 /*return*/, normalizedRate];
        }
      });
    });
  };
  Toolkit.prototype.getMaxRateByPair = function (sourceToken, targetToken) {
    return __awaiter(this, arguments, void 0, function () {
      var orders,
        _a,
        _b,
        maxRate,
        decimals,
        sourceDecimals,
        targetDecimals,
        normalizedRate;
      return __generator(this, function (_c) {
        switch (_c.label) {
          case 0:
            logger.debug('getMaxRateByPair called', arguments);
            _b = (_a = Object).values;
            return [
              4 /*yield*/,
              this._cache.getOrdersByPair(sourceToken, targetToken),
            ];
          case 1:
            orders = _b.apply(_a, [_c.sent()]).map(encoders_1.decodeOrder);
            maxRate = (0, stats_1.getMaxRate)(orders).toString();
            decimals = this._decimals;
            return [4 /*yield*/, decimals.fetchDecimals(sourceToken)];
          case 2:
            sourceDecimals = _c.sent();
            return [4 /*yield*/, decimals.fetchDecimals(targetToken)];
          case 3:
            targetDecimals = _c.sent();
            normalizedRate = (0, utils_1.normalizeRate)(
              maxRate,
              sourceDecimals,
              targetDecimals,
            );
            logger.debug('getMaxRateByPair info:', {
              orders: orders,
              maxRate: maxRate,
              sourceDecimals: sourceDecimals,
              targetDecimals: targetDecimals,
              normalizedRate: normalizedRate,
            });
            return [2 /*return*/, normalizedRate];
        }
      });
    });
  };
  return Toolkit;
})();
exports.Toolkit = Toolkit;
