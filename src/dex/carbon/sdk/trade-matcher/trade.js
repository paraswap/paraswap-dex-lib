'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.getDecodedTradeSourceAmount =
  exports.getDecodedTradeTargetAmount =
  exports.getEncodedTradeSourceAmount =
  exports.getEncodedTradeTargetAmount =
    void 0;
var numerics_1 = require('../utils/numerics');
var encoders_1 = require('../utils/encoders');
var C = numerics_1.BigNumber.from(numerics_1.ONE);
var MAX_UINT128 = numerics_1.BigNumber.from(2).pow(128).sub(1);
var MAX_UINT256 = numerics_1.BigNumber.from(2).pow(256).sub(1);
function check(val, max) {
  if (val.gte(0) && val.lte(max)) {
    return val;
  }
  throw null;
}
var uint128 = function (n) {
  return check(n, MAX_UINT128);
};
var add = function (a, b) {
  return check(a.add(b), MAX_UINT256);
};
var sub = function (a, b) {
  return check(a.sub(b), MAX_UINT256);
};
var mul = function (a, b) {
  return check(a.mul(b), MAX_UINT256);
};
var mulDivF = function (a, b, c) {
  return check(a.mul(b).div(c), MAX_UINT256);
};
var mulDivC = function (a, b, c) {
  return check(a.mul(b).add(c).sub(1).div(c), MAX_UINT256);
};
//
//       x * (A * y + B * z) ^ 2
//  ---------------------------------
//   A * x * (A * y + B * z) + z ^ 2
//
var getEncodedTradeBySourceAmount = function (x, y, z, A, B) {
  if (A.eq(0)) {
    return mulDivF(x, mul(B, B), mul(C, C));
  }
  var temp1 = mul(z, C);
  var temp2 = add(mul(y, A), mul(z, B));
  var temp3 = mul(temp2, x);
  var factor1 = mulDivC(temp1, temp1, MAX_UINT256);
  var factor2 = mulDivC(temp3, A, MAX_UINT256);
  var factor = (0, numerics_1.BigNumberMax)(factor1, factor2);
  var temp4 = mulDivC(temp1, temp1, factor);
  var temp5 = mulDivC(temp3, A, factor);
  return mulDivF(temp2, temp3.div(factor), add(temp4, temp5));
};
//
//                   x * z ^ 2
//  -------------------------------------------
//   (A * y + B * z) * (A * y + B * z - A * x)
//
var getEncodedTradeByTargetAmount = function (x, y, z, A, B) {
  if (A.eq(0)) {
    return mulDivC(x, mul(C, C), mul(B, B));
  }
  var temp1 = mul(z, C);
  var temp2 = add(mul(y, A), mul(z, B));
  var temp3 = sub(temp2, mul(x, A));
  var factor1 = mulDivC(temp1, temp1, MAX_UINT256);
  var factor2 = mulDivC(temp2, temp3, MAX_UINT256);
  var factor = (0, numerics_1.BigNumberMax)(factor1, factor2);
  var temp4 = mulDivC(temp1, temp1, factor);
  var temp5 = mulDivF(temp2, temp3, factor);
  return mulDivC(x, temp4, temp5);
};
//
//      M * M * x * y
//  ---------------------
//   M * (M - L) * x + y
//
var getDecodedTradeBySourceAmount = function (x, y, L, M) {
  var n = M.mul(M).mul(x).mul(y);
  var d = M.mul(M.sub(L)).mul(x).add(y);
  return n.div(d);
};
//
//              x * y
//  -----------------------------
//   M * (L - M) * x + M * M * y
//
var getDecodedTradeByTargetAmount = function (x, y, L, M) {
  var n = x.mul(y);
  var d = M.mul(L.sub(M)).mul(x).add(M.mul(M).mul(y));
  return n.div(d);
};
var getEncodedTradeTargetAmount = function (amount, order) {
  var x = amount;
  var y = order.y;
  var z = order.z;
  var A = (0, encoders_1.decodeFloat)(order.A);
  var B = (0, encoders_1.decodeFloat)(order.B);
  try {
    return uint128(getEncodedTradeBySourceAmount(x, y, z, A, B));
  } catch (error) {
    return numerics_1.BigNumber.from(0); /* rate = zero / amount = zero */
  }
};
exports.getEncodedTradeTargetAmount = getEncodedTradeTargetAmount;
var getEncodedTradeSourceAmount = function (amount, order) {
  var x = amount;
  var y = order.y;
  var z = order.z;
  var A = (0, encoders_1.decodeFloat)(order.A);
  var B = (0, encoders_1.decodeFloat)(order.B);
  try {
    return uint128(getEncodedTradeByTargetAmount(x, y, z, A, B));
  } catch (error) {
    return MAX_UINT128; /* rate = amount / infinity = zero */
  }
};
exports.getEncodedTradeSourceAmount = getEncodedTradeSourceAmount;
var getDecodedTradeTargetAmount = function (amount, order) {
  var x = amount;
  var y = new numerics_1.Decimal(order.liquidity);
  var L = new numerics_1.Decimal(order.lowestRate).sqrt();
  var M = new numerics_1.Decimal(order.marginalRate).sqrt();
  return getDecodedTradeBySourceAmount(x, y, L, M);
};
exports.getDecodedTradeTargetAmount = getDecodedTradeTargetAmount;
var getDecodedTradeSourceAmount = function (amount, order) {
  var x = amount;
  var y = new numerics_1.Decimal(order.liquidity);
  var L = new numerics_1.Decimal(order.lowestRate).sqrt();
  var M = new numerics_1.Decimal(order.marginalRate).sqrt();
  return getDecodedTradeByTargetAmount(x, y, L, M);
};
exports.getDecodedTradeSourceAmount = getDecodedTradeSourceAmount;
