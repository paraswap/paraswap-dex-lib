'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.formatUnits =
  exports.parseUnits =
  exports.mulDiv =
  exports.DecToBn =
  exports.BnToDec =
  exports.tenPow =
  exports.TEN =
  exports.ONE =
  exports.BigNumberMax =
  exports.BigNumberMin =
  exports.BigNumber =
  exports.Decimal =
    void 0;
var bignumber_1 = require('@ethersproject/bignumber');
Object.defineProperty(exports, 'BigNumber', {
  enumerable: true,
  get: function () {
    return bignumber_1.BigNumber;
  },
});
var units_1 = require('@ethersproject/units');
var decimal_js_1 = require('decimal.js');
exports.Decimal = decimal_js_1.default;
decimal_js_1.default.set({
  precision: 100,
  rounding: decimal_js_1.default.ROUND_HALF_DOWN,
  toExpNeg: -30,
  toExpPos: 30,
});
var BigNumberMin = function (a, b) {
  return a.lt(b) ? a : b;
};
exports.BigNumberMin = BigNumberMin;
var BigNumberMax = function (a, b) {
  return a.gt(b) ? a : b;
};
exports.BigNumberMax = BigNumberMax;
exports.ONE = Math.pow(2, 48);
exports.TEN = new decimal_js_1.default(10);
var tenPow = function (dec0, dec1) {
  var diff = dec0 - dec1;
  return exports.TEN.pow(diff);
};
exports.tenPow = tenPow;
var BnToDec = function (x) {
  return new decimal_js_1.default(x.toString());
};
exports.BnToDec = BnToDec;
var DecToBn = function (x) {
  return bignumber_1.BigNumber.from(x.toFixed());
};
exports.DecToBn = DecToBn;
var mulDiv = function (x, y, z) {
  return y.eq(z) ? x : x.mul(y).div(z);
};
exports.mulDiv = mulDiv;
function trimDecimal(input, precision) {
  var decimalIdx = input.indexOf('.');
  if (decimalIdx !== -1) {
    return input.slice(0, decimalIdx + precision + 1);
  }
  return input;
}
// A take on parseUnits that supports floating point
function parseUnits(amount, decimals) {
  var trimmed = trimDecimal(amount, decimals);
  return (0, units_1.parseUnits)(trimmed, decimals);
}
exports.parseUnits = parseUnits;
function formatUnits(amount, decimals) {
  var res = (0, units_1.formatUnits)(amount, decimals);
  // remove trailing 000
  return new decimal_js_1.default(res).toFixed();
}
exports.formatUnits = formatUnits;
