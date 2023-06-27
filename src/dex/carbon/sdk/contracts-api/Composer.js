'use strict';
var __assign =
  (this && this.__assign) ||
  function () {
    __assign =
      Object.assign ||
      function (t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s)
            if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
      };
    return __assign.apply(this, arguments);
  };
Object.defineProperty(exports, '__esModule', { value: true });
var utils_1 = require('./utils');
var logger_1 = require('../common/logger');
var logger = new logger_1.Logger('Composer.ts');
/**
 * Class that composes and populates transactions for trade and strategy management.
 */
var Composer = /** @class */ (function () {
  function Composer(contracts) {
    this._contracts = contracts;
  }
  /**
   *
   * @param {string} sourceToken - The address of the token to be traded.
   * @param {string} targetToken - The address of the token to be received.
   * @param {TradeAction[]} tradeActions - The list of trade actions to be executed.
   * @param {BigNumberish} deadline - The deadline for the trade.
   * @param {BigNumberish} maxInput - The maximum amount of source token to be traded.
   * @param {PayableOverrides} overrides - The overrides for the transaction.
   * @returns {Promise<PopulatedTransaction>} - The populated transaction.
   */
  Composer.prototype.tradeByTargetAmount = function (
    sourceToken,
    targetToken,
    tradeActions,
    deadline,
    maxInput,
    overrides,
  ) {
    logger.debug('tradeByTargetAmount called', arguments);
    var customOverrides = (0, utils_1.buildTradeOverrides)(
      sourceToken,
      tradeActions,
      true,
      maxInput,
      overrides,
    );
    logger.debug('tradeByTargetAmount overrides', customOverrides);
    return this._contracts.carbonController.populateTransaction.tradeByTargetAmount(
      sourceToken,
      targetToken,
      tradeActions,
      deadline,
      maxInput,
      customOverrides,
    );
  };
  /**
   * Populates a transaction to trade a given amount of source token.
   * @param {string} sourceToken - The address of the token to be traded.
   * @param {string} targetToken - The address of the token to be received.
   * @param {TradeAction[]} tradeActions - The list of trade actions to be executed.
   * @param {BigNumberish} deadline - The deadline for the trade.
   * @param {BigNumberish} minReturn - The minimum amount of target token to be received.
   * @param {PayableOverrides} overrides - The overrides for the transaction.
   * @returns {Promise<PopulatedTransaction>} - The populated transaction.
   */
  Composer.prototype.tradeBySourceAmount = function (
    sourceToken,
    targetToken,
    tradeActions,
    deadline,
    minReturn,
    overrides,
  ) {
    logger.debug('tradeBySourceAmount called', arguments);
    var customOverrides = (0, utils_1.buildTradeOverrides)(
      sourceToken,
      tradeActions,
      false,
      -1,
      overrides,
    );
    logger.debug('tradeBySourceAmount overrides', customOverrides);
    return this._contracts.carbonController.populateTransaction.tradeBySourceAmount(
      sourceToken,
      targetToken,
      tradeActions,
      deadline,
      minReturn,
      customOverrides,
    );
  };
  Composer.prototype.createStrategy = function (
    token0,
    token1,
    order0,
    order1,
    overrides,
  ) {
    logger.debug('createStrategy called', arguments);
    var customOverrides = __assign({}, overrides);
    if ((0, utils_1.isETHAddress)(token0)) {
      customOverrides.value = order0.y;
    } else if ((0, utils_1.isETHAddress)(token1)) {
      customOverrides.value = order1.y;
    }
    logger.debug('createStrategy overrides', customOverrides);
    return this._contracts.carbonController.populateTransaction.createStrategy(
      token0,
      token1,
      [order0, order1],
      customOverrides,
    );
  };
  Composer.prototype.deleteStrategy = function (id) {
    return this._contracts.carbonController.populateTransaction.deleteStrategy(
      id,
    );
  };
  Composer.prototype.updateStrategy = function (
    strategyId,
    token0,
    token1,
    currentOrders,
    newOrders,
    overrides,
  ) {
    var customOverrides = __assign({}, overrides);
    if (
      (0, utils_1.isETHAddress)(token0) &&
      newOrders[0].y.gt(currentOrders[0].y)
    ) {
      customOverrides.value = newOrders[0].y.sub(currentOrders[0].y);
    } else if (
      (0, utils_1.isETHAddress)(token1) &&
      newOrders[1].y.gt(currentOrders[1].y)
    ) {
      customOverrides.value = newOrders[1].y.sub(currentOrders[1].y);
    }
    logger.debug('updateStrategy overrides', customOverrides);
    return this._contracts.carbonController.populateTransaction.updateStrategy(
      strategyId,
      currentOrders,
      newOrders,
      customOverrides,
    );
  };
  return Composer;
})();
exports.default = Composer;
