'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.getDepths = exports.getMaxRate = exports.getMinRate = void 0;
var numerics_1 = require('../utils/numerics');
function getMinRate(orders) {
  return orders.reduce(function (rate, order) {
    return numerics_1.Decimal.min(rate, order.lowestRate);
  }, new numerics_1.Decimal(+Infinity));
}
exports.getMinRate = getMinRate;
function getMaxRate(orders) {
  return orders.reduce(function (rate, order) {
    return numerics_1.Decimal.max(rate, order.marginalRate);
  }, new numerics_1.Decimal(-Infinity));
}
exports.getMaxRate = getMaxRate;
function getDepths(orders, rates) {
  var processedOrders = orders.map(function (order) {
    var min = new numerics_1.Decimal(order.lowestRate).sqrt();
    var mid = new numerics_1.Decimal(order.marginalRate).sqrt();
    return {
      liq: new numerics_1.Decimal(order.liquidity),
      min: min,
      mid: mid,
      midMinusMin: mid.sub(min),
    };
  });
  return rates.map(function (rate) {
    var rateRoot = rate.sqrt();
    return processedOrders.reduce(function (sum, order) {
      return sum.add(getAmount(order, rateRoot));
    }, new numerics_1.Decimal(0));
  });
}
exports.getDepths = getDepths;
/**
 * Given an order with:
 * - liquidity: the liquidity of the order
 * - lowestRate: the most expensive rate at which the order will sell its liquidity
 * - marginalRate: the rate at which the order is currently selling its liquidity
 * If a given rate is:
 * - more expensive (lower) than lowestRate: all of the liquidity can be bought at this rate
 * - less expensive (higher) than marginalRate: none of the liquidity can be bought at this rate
 * - in between lowestRate and marginalRate: some of the liquidity can be bought at this rate
 * @param {ProcessedOrder} order
 * @param {Decimal} rateRoot - the square root of the rate
 * @returns {Decimal} the amount of liquidity that can be bought without paying more than the given rate
 */
function getAmount(order, rateRoot) {
  // rate <= lowestRate - all of the liquidity can be bought at this rate
  if (rateRoot.lte(order.min)) {
    return order.liq;
  }
  // rate >= marginalRate - none of the liquidity can be bought at this rate
  if (rateRoot.gte(order.mid)) {
    return new numerics_1.Decimal(0);
  }
  // lowestRate < rate < marginalRate
  return order.liq.sub(
    order.liq.mul(rateRoot.sub(order.min)).div(order.midMinusMin),
  );
}
