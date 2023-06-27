'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.decodeOrder =
  exports.encodeOrder =
  exports.decodeFloat =
  exports.encodeFloat =
  exports.decodeRate =
  exports.encodeRate =
    void 0;
var numerics_1 = require('./numerics');
function bitLength(value) {
  return value.gt(0)
    ? numerics_1.Decimal.log2(value.toString()).add(1).floor().toNumber()
    : 0;
}
var encodeRate = function (value) {
  var data = (0, numerics_1.DecToBn)(value.sqrt().mul(numerics_1.ONE).floor());
  var length = bitLength(data.div(numerics_1.ONE));
  return (0, numerics_1.BnToDec)(data.shr(length).shl(length));
};
exports.encodeRate = encodeRate;
var decodeRate = function (value) {
  return value.div(numerics_1.ONE).pow(2);
};
exports.decodeRate = decodeRate;
var encodeFloat = function (value) {
  var exponent = bitLength(value.div(numerics_1.ONE));
  var mantissa = value.shr(exponent);
  return numerics_1.BigNumber.from(numerics_1.ONE).mul(exponent).or(mantissa);
};
exports.encodeFloat = encodeFloat;
var decodeFloat = function (value) {
  return value.mod(numerics_1.ONE).shl(value.div(numerics_1.ONE).toNumber());
};
exports.decodeFloat = decodeFloat;
var encodeOrder = function (order) {
  var liquidity = new numerics_1.Decimal(order.liquidity);
  var lowestRate = new numerics_1.Decimal(order.lowestRate);
  var highestRate = new numerics_1.Decimal(order.highestRate);
  var marginalRate = new numerics_1.Decimal(order.marginalRate);
  if (
    !(
      (highestRate.gte(marginalRate) && marginalRate.gt(lowestRate)) ||
      (highestRate.eq(marginalRate) && marginalRate.eq(lowestRate))
    )
  ) {
    throw new Error(
      'Either one of the following must hold:\n' +
        '- highestRate >= marginalRate > lowestRate\n' +
        '- highestRate == marginalRate == lowestRate\n' +
        '(highestRate = '
          .concat(highestRate, ', marginalRate = ')
          .concat(marginalRate, ', lowestRate = ')
          .concat(lowestRate, ')'),
    );
  }
  var y = (0, numerics_1.DecToBn)(liquidity);
  var L = (0, numerics_1.DecToBn)((0, exports.encodeRate)(lowestRate));
  var H = (0, numerics_1.DecToBn)((0, exports.encodeRate)(highestRate));
  var M = (0, numerics_1.DecToBn)((0, exports.encodeRate)(marginalRate));
  return {
    y: y,
    z: H.eq(M) ? y : y.mul(H.sub(L)).div(M.sub(L)),
    A: (0, exports.encodeFloat)(H.sub(L)),
    B: (0, exports.encodeFloat)(L),
  };
};
exports.encodeOrder = encodeOrder;
var decodeOrder = function (order) {
  var y = (0, numerics_1.BnToDec)(order.y);
  var z = (0, numerics_1.BnToDec)(order.z);
  var A = (0, numerics_1.BnToDec)((0, exports.decodeFloat)(order.A));
  var B = (0, numerics_1.BnToDec)((0, exports.decodeFloat)(order.B));
  return {
    liquidity: y.toString(),
    lowestRate: (0, exports.decodeRate)(B).toString(),
    highestRate: (0, exports.decodeRate)(B.add(A)).toString(),
    marginalRate: (0, exports.decodeRate)(
      y.eq(z) ? B.add(A) : B.add(A.mul(y).div(z)),
    ).toString(),
  };
};
exports.decodeOrder = decodeOrder;
