'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.tradeActionStrToBN =
  exports.tradeActionBNToStr =
  exports.matchActionStrToBN =
  exports.matchActionBNToStr =
  exports.ordersMapStrToBN =
  exports.ordersMapBNToStr =
  exports.encodedStrategyStrToBN =
  exports.encodedStrategyBNToStr =
  exports.encodedOrderStrToBN =
  exports.encodedOrderBNToStr =
  exports.replaceBigNumbersWithStrings =
  exports.deserialize =
    void 0;
var numerics_1 = require('./numerics');
/**
 * Helper utility to deserialize a value that was contains BigNumber instances
 * @returns
 */
var deserialize = function (value) {
  if (
    typeof value === 'object' &&
    value !== null &&
    value.type === 'BigNumber' &&
    value.hex !== null
  ) {
    return numerics_1.BigNumber.from(value.hex);
  }
  if (Array.isArray(value)) {
    return value.map(exports.deserialize);
  }
  if (typeof value === 'object' && value !== null) {
    var deserializedObj = {};
    for (var key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        deserializedObj[key] = (0, exports.deserialize)(value[key]);
      }
    }
    return deserializedObj;
  }
  return value;
};
exports.deserialize = deserialize;
var replaceBigNumbersWithStrings = function (obj) {
  function replace(obj) {
    if (numerics_1.BigNumber.isBigNumber(obj)) {
      return obj.toString();
    }
    if (typeof obj === 'object' && obj !== null) {
      var newObj = Array.isArray(obj) ? [] : {};
      for (var key in obj) {
        newObj[key] = replace(obj[key]);
      }
      return newObj;
    }
    return obj;
  }
  return replace(obj);
};
exports.replaceBigNumbersWithStrings = replaceBigNumbersWithStrings;
var encodedOrderBNToStr = function (order) {
  return (0, exports.replaceBigNumbersWithStrings)(order);
};
exports.encodedOrderBNToStr = encodedOrderBNToStr;
var encodedOrderStrToBN = function (order) {
  return {
    y: numerics_1.BigNumber.from(order.y),
    z: numerics_1.BigNumber.from(order.z),
    A: numerics_1.BigNumber.from(order.A),
    B: numerics_1.BigNumber.from(order.B),
  };
};
exports.encodedOrderStrToBN = encodedOrderStrToBN;
var encodedStrategyBNToStr = function (strategy) {
  return (0, exports.replaceBigNumbersWithStrings)(strategy);
};
exports.encodedStrategyBNToStr = encodedStrategyBNToStr;
var encodedStrategyStrToBN = function (strategy) {
  return {
    id: numerics_1.BigNumber.from(strategy.id),
    token0: strategy.token0,
    token1: strategy.token1,
    order0: (0, exports.encodedOrderStrToBN)(strategy.order0),
    order1: (0, exports.encodedOrderStrToBN)(strategy.order1),
  };
};
exports.encodedStrategyStrToBN = encodedStrategyStrToBN;
var ordersMapBNToStr = function (ordersMap) {
  return (0, exports.replaceBigNumbersWithStrings)(ordersMap);
};
exports.ordersMapBNToStr = ordersMapBNToStr;
var ordersMapStrToBN = function (ordersMap) {
  var deserialized = {};
  for (var _i = 0, _a = Object.entries(ordersMap); _i < _a.length; _i++) {
    var _b = _a[_i],
      id = _b[0],
      order = _b[1];
    deserialized[id] = (0, exports.encodedOrderStrToBN)(order);
  }
  return deserialized;
};
exports.ordersMapStrToBN = ordersMapStrToBN;
var matchActionBNToStr = function (action) {
  return (0, exports.replaceBigNumbersWithStrings)(action);
};
exports.matchActionBNToStr = matchActionBNToStr;
var matchActionStrToBN = function (action) {
  return {
    id: numerics_1.BigNumber.from(action.id),
    input: numerics_1.BigNumber.from(action.input),
    output: numerics_1.BigNumber.from(action.output),
  };
};
exports.matchActionStrToBN = matchActionStrToBN;
var tradeActionBNToStr = function (action) {
  return (0, exports.replaceBigNumbersWithStrings)(action);
};
exports.tradeActionBNToStr = tradeActionBNToStr;
var tradeActionStrToBN = function (action) {
  return {
    strategyId: numerics_1.BigNumber.from(action.strategyId),
    amount: numerics_1.BigNumber.from(action.amount),
  };
};
exports.tradeActionStrToBN = tradeActionStrToBN;
