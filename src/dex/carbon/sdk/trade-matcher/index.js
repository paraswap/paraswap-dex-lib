'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.getEncodedTradeSourceAmount =
  exports.getEncodedTradeTargetAmount =
  exports.matchByTargetAmount =
  exports.matchBySourceAmount =
    void 0;
var match_1 = require('./match');
Object.defineProperty(exports, 'matchBySourceAmount', {
  enumerable: true,
  get: function () {
    return match_1.matchBySourceAmount;
  },
});
Object.defineProperty(exports, 'matchByTargetAmount', {
  enumerable: true,
  get: function () {
    return match_1.matchByTargetAmount;
  },
});
var trade_1 = require('./trade');
Object.defineProperty(exports, 'getEncodedTradeTargetAmount', {
  enumerable: true,
  get: function () {
    return trade_1.getEncodedTradeTargetAmount;
  },
});
Object.defineProperty(exports, 'getEncodedTradeSourceAmount', {
  enumerable: true,
  get: function () {
    return trade_1.getEncodedTradeSourceAmount;
  },
});
